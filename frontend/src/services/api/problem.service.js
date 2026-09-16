import { apiClient } from './client.js';

export const problemService = {
  async getProblems(params = {}) {
    const query = new URLSearchParams();
    if (params.difficulty && params.difficulty !== 'ALL') {
      query.append('difficulty', params.difficulty);
    }
    const endpoint = `/problems${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiClient.get(endpoint);
    return res.data.problems || [];
  },

  async getProblemById(problemId) {
    const res = await apiClient.get(`/problems/${problemId}`);
    return res.data.problem;
  },

  async getPublicTestCases(problemId) {
    try {
      const res = await apiClient.get(`/problems/${problemId}/test-cases`);
      return res.data.testCases || [];
    } catch {
      return [];
    }
  }
};
