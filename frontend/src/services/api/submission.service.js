import { apiClient } from './client.js';

export const submissionService = {
  /**
   * Submit solution code to a problem.
   * Sends ONLY client-allowed fields: problemId, language, sourceCode.
   */
  async createSubmission({ problemId, language = 'CPP', sourceCode }) {
    const res = await apiClient.post('/submissions', {
      problemId,
      language,
      sourceCode
    });
    return res.data.submission;
  },

  async getSubmissionById(submissionId) {
    const res = await apiClient.get(`/submissions/${submissionId}`);
    return res.data.submission;
  },

  async getMySubmissions(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.problemId) query.append('problemId', params.problemId);
    if (params.language) query.append('language', params.language);
    if (params.verdict) query.append('verdict', params.verdict);
    if (params.includeCode !== undefined) query.append('includeCode', params.includeCode);

    const endpoint = `/submissions/me${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiClient.get(endpoint);
    return res.data; // { submissions: [...], pagination: { ... } }
  }
};
