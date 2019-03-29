'use strict';

// controller 级别中间

/**
 * @param opts
 *
 * opts.module 处理中间名字
 * opts.sessionName 当前会话
 * opts.isEnd 是否是终点业务
 *
 * @return {Function}
 */

function validAuthData(authData, opts) {
  if (opts.sessionName) {
    if (authData.sessionName !== opts.sessionName) {
      return `AuthData 验证失败 sessionName 不一致 期望是 ${opts.sessionName} 实际是: ${authData.sessionName}:`;
    }
  }

  if (opts.isEnd) { // 业务终点
    if (authData.hasNextStep()) {
      return `AuthData 验证失败 此时为业务终点,不应该有后续 steps 操作， 但 steps 没有处理完！ ${authData.steps.join(',')}`;
    }
  } else { // 业务 中间
    if (opts.module && authData.nextStep !== opts.module) {
      return `AuthData 验证失败 对应处理模块不对 期望是: ${opts.module} 实际是: ${authData.nextStep}`;
    }
  }

  return true;
}

module.exports = (opts = {}) => {

  return async function(ctx, next) {

    const { logger, request, query } = ctx;
    const authToken = request.headers['auth-token'] || request.body.auth_token || query.auth_token;

    if (!authToken) {
      logger.info('authToken 未设置！');
      ctx.formatFailResp({ errCode: 'F403' });
      return;
    }

    const authData = await ctx.findAuthData(authToken);
    if (!authData) {
      logger.info(`authToken: ${authToken} 已经失效！`);
      ctx.formatFailResp({ errCode: 'F401-1' });
      return;
    }

    const validAuthDataMsg = validAuthData(authData, opts);
    if (validAuthDataMsg !== true) {
      logger.info(`authToken 验证失败 原因是: ${validAuthDataMsg}`);
      ctx.formatFailResp({ errCode: 'F401-1' });
      return;
    }

    ctx.authData = request.authData = authData;

    await next();

    // readonly is just read .
    if (opts.readonly) return;

    // 业务终点，结束token， 这样让其过期
    if (!ctx.isSuccessResp()) return;

    // 上一步成功后
    await ctx.destroyAuthData(authToken);

    if (!ctx.authData) return;
    ctx.authData.popStep();

    // 非业务终点会，自动产生新的auth_token
    if (opts.isEnd) return;

    // 这里即使消费掉了nextStep 到了最后一步，依然会持续刷新当前的。
    const copyAuthData = ctx.authData.toJSON();
    copyAuthData.authToken = undefined;
    copyAuthData.random = undefined;
    const newAuthData = await ctx.createAuthData(copyAuthData);
    ctx.appendAuthData2Resp(newAuthData);
  };
};
