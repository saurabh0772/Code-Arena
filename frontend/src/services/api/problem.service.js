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
  },

  async createProblem(data) {
    const payload = {
      title: data.title,
      description: data.description,
      difficulty: data.difficulty,
      tags: Array.isArray(data.tags) ? data.tags : [],
      inputFormat: data.inputFormat,
      outputFormat: data.outputFormat,
      constraints: data.constraints,
      examples: Array.isArray(data.examples) ? data.examples : []
    };
    const res = await apiClient.post('/problems', payload);
    return res.data.problem;
  },

  async updateProblem(problemId, data) {
    const payload = {};
    const allowed = [
      'title',
      'description',
      'difficulty',
      'tags',
      'inputFormat',
      'outputFormat',
      'constraints',
      'examples'
    ];
    allowed.forEach((k) => {
      if (data[k] !== undefined) payload[k] = data[k];
    });
    const res = await apiClient.patch(`/problems/${problemId}`, payload);
    return res.data.problem;
  },

  async deactivateProblem(problemId) {
    const res = await apiClient.delete(`/problems/${problemId}`);
    return res;
  }
};
