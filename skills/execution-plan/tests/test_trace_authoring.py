"""Behavioral probes of the owned profile against the real Trace runtime.

Set MARKDOWN_TRACE_SKILL_DIR to the installed shared skill. Preserve the host's
MARKDOWN_TRACE_BIN binding; these tests neither install nor select a runtime.
"""
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

EXAMPLES = ['references/example-execution-plan.md']
DEFINITION = '[EP-ACT-1](ctx://trace/entity/EP-ACT-1?role=definition)'
DEFINITION_LABEL = 'EP-ACT-1'
DEFINITION_RULE = 'action-id-definitions'
EDGE = '[EP-OUT-1](ctx://trace/entity/EP-OUT-1?rel=implements)'
EDGE_GENERIC = '[EP-OUT-1](ctx://trace/entity/EP-OUT-1)'
EDGE_WRONG = '[EP-OUT-1](ctx://trace/entity/CTX-1?rel=implements)'
EDGE_RULE = 'implements-outcomes'
HEADING = '[Add dry-run behavior to cache pruning](ctx://trace/entity/CTX-1?role=definition)'
HEADING_LABEL = 'Add dry-run behavior to cache pruning'
RELATION = 'implements'
ROOTS = ['EP-ACT-1', 'CTX-9']
INCLUDED = ['EP-ACT-1', 'CTX-9', 'EP-OUT-1']
EXCLUDED = 'EP-OUT-2'
REQUIRED_TEXT = '| Step ID | Kind | Phase ID | Required prior Step IDs |'

class TraceAuthoring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        skill = os.environ.get('MARKDOWN_TRACE_SKILL_DIR')
        if not skill:
            raise RuntimeError('Set MARKDOWN_TRACE_SKILL_DIR; missing runtime is not a passing/skipped probe.')
        cls.command = ['node', str(Path(skill).resolve() / 'scripts/run.mjs')]
        info = subprocess.run(cls.command + ['--runtime-info'], capture_output=True, text=True)
        if info.returncode:
            raise RuntimeError(info.stderr)
        cls.identity = json.loads(info.stdout)
        if cls.identity['packageVersion'] != '0.1.3':
            raise RuntimeError('Requalify this profile against the selected Trace release.')
        cls.original = (ROOT / EXAMPLES[0]).read_text()
        print('Trace source:', cls.identity['sourceCommit'])

    def invoke(self, source, *args):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'artifact.md'
            path.write_text(source)
            result = subprocess.run(self.command + ['--file', str(path), '--profile',
                str(ROOT / 'profiles/trace.json'), *args], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 2, result.stderr)
            return result.returncode, json.loads(result.stdout)

    def defect(self, before, after, rule):
        self.assertIn(before, self.original)
        changed = self.original.replace(before, after, 1)
        status, report = self.invoke(changed)
        self.assertEqual(status, 1, report)
        matches = [d for d in report['diagnostics'] if d['ruleId'] == rule]
        self.assertTrue(matches, report['diagnostics'])
        expected_line = self.original[:self.original.index(before)].count('\n') + 1
        self.assertTrue(any(d.get('line') == expected_line for d in matches), matches)
        status, report = self.invoke(self.original)
        self.assertEqual(status, 0, report)

    def test_examples_and_required_rules(self):
        for example in EXAMPLES:
            with self.subTest(example=example):
                status, report = self.invoke((ROOT / example).read_text(), '--format', 'graph')
                self.assertEqual(status, 0, report)
                self.assertEqual(report['validation']['status'], 'pass')
                self.assertTrue(all(r['status'] == 'pass' for r in report['validation']['rules']))
                self.assertTrue(all(i['definition']['status'] == 'resolved'
                                    for i in report['graph']['identifiers']))

    def test_removed_definition_is_located(self):
        self.defect(DEFINITION, DEFINITION_LABEL, DEFINITION_RULE)

    def test_removed_required_edge_is_located(self):
        self.defect(EDGE, EDGE_GENERIC, EDGE_RULE)

    def test_forbidden_endpoint_is_located(self):
        self.defect(EDGE, EDGE_WRONG, 'builtin.allowed-relations')

    def test_unannotated_heading_is_located(self):
        self.defect(HEADING, HEADING_LABEL, 'heading-definitions')

    def test_exact_text_view_retains_the_machine_report(self):
        args = ['--direction', 'outgoing', '--relation', RELATION,
                '--max-depth', '2', '--max-nodes', '20', '--max-fragments', '80',
                '--max-utf8-bytes', '24000']
        for root in ROOTS:
            args += ['--root', root]
        with tempfile.TemporaryDirectory() as directory:
            document = Path(directory) / 'artifact.md'
            retained = Path(directory) / 'context-report.json'
            document.write_text(self.original)
            command = self.command + ['--file', str(document), '--profile',
                str(ROOT / 'profiles/trace.json'), *args]
            machine = subprocess.run(command + ['--format', 'context'], capture_output=True)
            text = subprocess.run(command + ['--format', 'context-text', '--report-file',
                str(retained)], capture_output=True)
            self.assertEqual(machine.returncode, 0, machine.stderr)
            self.assertEqual(text.returncode, 0, text.stderr)
            self.assertEqual(text.stderr, b'')
            self.assertEqual(retained.read_bytes(), machine.stdout)
            report = json.loads(machine.stdout)
            excerpts = [match[1] for match in re.findall(
                rb'^(`{3,})text\n([\s\S]*?)\n\1\n', text.stdout, re.M)]
            self.assertEqual(excerpts, [part['text'].encode() for part in report['context']['parts']])
            self.assertIn(REQUIRED_TEXT.encode(), text.stdout)
            self.assertIn(hashlib.sha256(machine.stdout).hexdigest().encode(), text.stdout)
            self.assertIn(b'Required-context completeness: not evaluated', text.stdout)
            self.assertLess(len(text.stdout), len(machine.stdout))

    def test_exact_scoped_context_and_budget_omission(self):
        args = ['--format', 'context', '--direction', 'outgoing', '--relation', RELATION,
                '--max-depth', '2', '--max-nodes', '20', '--max-fragments', '80']
        for root in ROOTS:
            args += ['--root', root]
        status, report = self.invoke(self.original, *args, '--max-utf8-bytes', '24000')
        self.assertEqual(status, 0, report)
        context = report['context']
        self.assertEqual(context['source']['sha256'], hashlib.sha256(self.original.encode()).hexdigest())
        self.assertEqual(set(context['includedIdentifiers']), set(INCLUDED))
        self.assertEqual(context['omittedIdentifiers'], [])
        self.assertFalse(any(context['selection']['boundary'].values()))
        self.assertNotIn(EXCLUDED, context['includedIdentifiers'])
        joined = '\n'.join(p['text'] for p in context['parts'])
        self.assertIn(REQUIRED_TEXT, joined)
        for part in context['parts']:
            self.assertIn(part['text'], self.original)
        # Validation can pass while the selected text is completely omitted.
        status, report = self.invoke(self.original, *args, '--max-utf8-bytes', '0')
        self.assertEqual(status, 0, report)
        self.assertEqual(report['context']['includedIdentifiers'], [])
        self.assertTrue(report['context']['omittedIdentifiers'])


if __name__ == '__main__':
    unittest.main()
