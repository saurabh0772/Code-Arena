import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Eye,
  EyeOff,
  Save
} from 'lucide-react';
import { problemService } from '../../services/api/problem.service';
import { testCaseService } from '../../services/api/testcase.service';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

export function AdminTestCases() {
  const { problemId } = useParams();

  const [problem, setProblem] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [modalOutput, setModalOutput] = useState('');
  const [modalVisibility, setModalVisibility] = useState('PUBLIC');
  const [modalOrder, setModalOrder] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Deactivate Modal State
  const [deactivatingTestCase, setDeactivatingTestCase] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [probData, tcData] = await Promise.all([
        problemService.getProblemById(problemId),
        testCaseService.getTestCasesForProblem(problemId)
      ]);
      setProblem(probData);
      setTestCases(tcData);
    } catch (err) {
      setError(err.message || 'Failed to load test cases');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [problemId]);

  const handleOpenAddModal = () => {
    setEditingTestCase(null);
    setModalInput('');
    setModalOutput('');
    setModalVisibility('PUBLIC');
    // Default order to highest order + 1
    const maxOrder = testCases.reduce((max, tc) => Math.max(max, tc.order ?? 0), 0);
    setModalOrder(testCases.length > 0 ? maxOrder + 1 : 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tc) => {
    setEditingTestCase(tc);
    setModalInput(tc.input || '');
    setModalOutput(tc.expectedOutput || '');
    setModalVisibility(tc.visibility || 'PUBLIC');
    setModalOrder(tc.order ?? 1);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload = {
      input: modalInput,
      expectedOutput: modalOutput,
      visibility: modalVisibility,
      order: Number(modalOrder)
    };

    try {
      if (editingTestCase) {
        await testCaseService.updateTestCase(editingTestCase.id, payload);
        setSuccessMessage('Test case updated successfully.');
      } else {
        await testCaseService.createTestCase(problemId, payload);
        setSuccessMessage('Test case created successfully.');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save test case');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingTestCase) return;

    setIsDeactivating(true);
    setError(null);
    try {
      await testCaseService.deactivateTestCase(deactivatingTestCase.id);
      setSuccessMessage('Test case deactivated successfully.');
      setDeactivatingTestCase(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to deactivate test case');
    } finally {
      setIsDeactivating(false);
    }
  };

  const publicTestCases = testCases.filter((tc) => tc.visibility === 'PUBLIC');
  const hiddenTestCases = testCases.filter((tc) => tc.visibility === 'HIDDEN');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <Link
            to="/admin/problems"
            className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Problems
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            <ListChecks className="w-6 h-6 text-primary" />
            Test Case Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Problem:{' '}
            <span className="text-slate-200 font-medium">
              {problem ? problem.title : 'Loading...'}
            </span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="primary" onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Test Case
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-400 text-sm animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center space-x-2.5 text-red-400 text-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Info Alert */}
      <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start space-x-3">
        <AlertCircle className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-slate-200 font-medium font-mono">
            Public vs. Hidden Test Case Isolation
          </p>
          <p>
            • <strong>PUBLIC</strong> test cases are readable by candidates for debugging and sample execution.
          </p>
          <p>
            • <strong>HIDDEN</strong> test cases are executed strictly inside the disposable Docker sandbox during evaluation. Their inputs and outputs are never sent to non-admin clients.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-sm space-y-3">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p>Loading test cases...</p>
        </div>
      ) : testCases.length === 0 ? (
        <div className="p-12 text-center text-slate-400 space-y-3 bg-surface/90 border border-border/80 rounded-xl">
          <ListChecks className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-medium text-slate-300">No test cases found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            This problem does not have any test cases yet. Add a public or hidden test case so submissions can be validated.
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Test Case
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Public Test Cases Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 font-mono flex items-center gap-2 uppercase tracking-wider">
                <Eye className="w-4 h-4 text-emerald-400" />
                Public Test Cases ({publicTestCases.length})
              </h2>
            </div>

            {publicTestCases.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-900/30 rounded-lg border border-slate-800/50">
                No public test cases configured.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicTestCases.map((tc) => (
                  <TestCaseCard
                    key={tc.id}
                    testCase={tc}
                    onEdit={handleOpenEditModal}
                    onDeactivate={setDeactivatingTestCase}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Hidden Test Cases Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 font-mono flex items-center gap-2 uppercase tracking-wider">
                <EyeOff className="w-4 h-4 text-amber-400" />
                Hidden Evaluation Test Cases ({hiddenTestCases.length})
              </h2>
            </div>

            {hiddenTestCases.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-900/30 rounded-lg border border-slate-800/50">
                No hidden test cases configured. Add hidden test cases to evaluate edge cases securely.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hiddenTestCases.map((tc) => (
                  <TestCaseCard
                    key={tc.id}
                    testCase={tc}
                    onEdit={handleOpenEditModal}
                    onDeactivate={setDeactivatingTestCase}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Test Case Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTestCase ? 'Edit Test Case' : 'Add Test Case'}
      >
        <form onSubmit={handleSaveModal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Visibility
              </label>
              <select
                value={modalVisibility}
                onChange={(e) => setModalVisibility(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                <option value="PUBLIC">PUBLIC (Sample / Visible)</option>
                <option value="HIDDEN">HIDDEN (Secret / Grading)</option>
              </select>
            </div>

            <div>
              <Input
                label="Execution Order"
                type="number"
                min="0"
                value={modalOrder}
                onChange={(e) => setModalOrder(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
              Standard Input (stdin)
            </label>
            <textarea
              rows={4}
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder="Test case input..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
              Expected Output (stdout)
            </label>
            <textarea
              rows={4}
              value={modalOutput}
              onChange={(e) => setModalOutput(e.target.value)}
              placeholder="Expected output..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border/80">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-1.5" />
              {editingTestCase ? 'Update Test Case' : 'Create Test Case'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal for Deactivation */}
      <Modal
        isOpen={!!deactivatingTestCase}
        onClose={() => setDeactivatingTestCase(null)}
        title="Confirm Test Case Deactivation"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Deactivation Confirmation</p>
              <p className="mt-0.5 text-rose-200/80">
                Are you sure you want to deactivate Test Case #{deactivatingTestCase?.order}?
                It will be soft-deleted and excluded from future evaluation pipelines.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border/80">
            <Button
              variant="secondary"
              size="sm"
              disabled={isDeactivating}
              onClick={() => setDeactivatingTestCase(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeactivating}
              onClick={handleConfirmDeactivate}
            >
              Deactivate Test Case
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TestCaseCard({ testCase, onEdit, onDeactivate }) {
  const isHidden = testCase.visibility === 'HIDDEN';

  return (
    <Card className="bg-surface/90 border-border/80 flex flex-col">
      <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold text-slate-300">
            Order #{testCase.order}
          </span>
          <Badge
            variant={isHidden ? 'warning' : 'success'}
            className="text-[10px] px-1.5 py-0"
          >
            {testCase.visibility}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-slate-400">
            Active
          </Badge>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(testCase)}
            className="h-7 px-2 text-indigo-400 hover:text-indigo-300"
            title="Edit Test Case"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeactivate(testCase)}
            className="h-7 px-2 text-rose-400 hover:text-rose-300"
            title="Deactivate Test Case"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3 flex-1">
        <div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Input:
          </span>
          <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto max-h-24">
            {testCase.input !== '' ? testCase.input : <span className="text-slate-600 italic">&lt;empty&gt;</span>}
          </pre>
        </div>

        <div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            Expected Output:
          </span>
          <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-24">
            {testCase.expectedOutput !== '' ? testCase.expectedOutput : <span className="text-slate-600 italic">&lt;empty&gt;</span>}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminTestCases;
