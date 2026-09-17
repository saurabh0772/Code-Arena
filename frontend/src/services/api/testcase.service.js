import { apiClient } from './client.js';

export const testCaseService = {
  /**
   * Retrieves test cases for a problem.
   * If called with an ADMIN token, the backend returns both PUBLIC and HIDDEN test cases.
   */
  async getTestCasesForProblem(problemId) {
    const res = await apiClient.get(`/problems/${problemId}/test-cases`);
    return res.data?.testCases || [];
  },

  /**
   * Creates a new test case for a problem (ADMIN only)
   */
  async createTestCase(problemId, data) {
    const payload = {
      input: data.input ?? '',
      expectedOutput: data.expectedOutput ?? '',
      visibility: data.visibility || 'PUBLIC',
      order: Number(data.order ?? 0)
    };
    const res = await apiClient.post(`/problems/${problemId}/test-cases`, payload);
    return res.data?.testCase;
  },

  /**
   * Updates an existing test case (ADMIN only)
   */
  async updateTestCase(testCaseId, data) {
    const payload = {};
    if (data.input !== undefined) payload.input = data.input;
    if (data.expectedOutput !== undefined) payload.expectedOutput = data.expectedOutput;
    if (data.visibility !== undefined) payload.visibility = data.visibility;
    if (data.order !== undefined) payload.order = Number(data.order);

    const res = await apiClient.patch(`/test-cases/${testCaseId}`, payload);
    return res.data?.testCase;
  },

  /**
   * Deactivates (soft deletes) a test case (ADMIN only)
   */
  async deactivateTestCase(testCaseId) {
    const res = await apiClient.delete(`/test-cases/${testCaseId}`);
    return res;
  }
};
