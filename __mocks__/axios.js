const axios = {
  post: jest.fn(() => Promise.resolve({ data: {} })),
  // Add other axios methods you use here
};

module.exports = axios;