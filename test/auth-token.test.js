'use strict';

const mock = require('egg-mock');

describe('test/auth-token.test.js', () => {
  let app;
  before(() => {
    app = mock.app({
      baseDir: 'apps/auth-token-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should GET /', () => {
    return app.httpRequest()
      .get('/')
      .expect('hi, alexZhang')
      .expect(200);
  });
});
