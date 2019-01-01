/**
 * Created by alex on 2017/9/16.
 */

'use strict';

const crypto = require('crypto');
const uuid = require('uuid');
const ms = require('ms');

class AuthData {

  constructor(ctx, props) {
    this._ctx = ctx;

    for (const k in props) {
      this[k] = props[k];
    }

    if (!this.sessionName) {
      throw new Error('AuthData sessionName is empty!');
    }

    if (!this.id) {
      throw new Error('AuthData id is empty!');
    }

    if (!this.maxAge) {
      throw new Error('AuthData maxAge is empty!');
    }

    if (!this.random) this.random = uuid();
    const timeStamp = new Date().getTime();
    if (!this.createAt) this.createAt = timeStamp;
    if (!this.updateAt) this.updateAt = timeStamp;

    if (!this.authToken) {
      this.authToken = crypto.createHash('md5').update(JSON.stringify({
        id: this.id,
        random: this.random,
        createAt: this.createAt,
      })).digest('hex');
    }

    if (!this.steps) this.steps = [];
  }

  popStep() {
    if (this.steps && this.steps.length > 0) {
      this.steps.shift();
    }
  }

  pushStep(step) {
    if (typeof step !== 'string') {
      throw new Error('Invalid Params step type, must be string.');
    }

    this.steps.push(step);
  }

  get nextStep() {
    if (this.steps && this.steps.length > 0) {
      return this.steps[0] || '';
    }
    return '';

  }

  hasNextStep() {
    return this.steps && this.steps.length > 0;
  }

  toJSON() {
    const obj = {};
    Object.keys(this).forEach(key => {
      if (typeof key !== 'string') return;
      if (key[0] === '_') return;

      obj[key] = this[key];
    });

    return obj;
  }

  toResp() {
    return {
      auth_id: this.id,
      session_name: this.sessionName,
      auth_token: this.authToken,
      auth_next_step: this.nextStep,
      auth_max_age: this.maxAge,
    };
  }
}

module.exports = {

  appendAuthData2Resp(authData) {
    if (!authData) return;

    if (!this.body.data) {
      this.body.data = {};
    }

    if (this.body.data.auth_token) return;

    // append this response.
    Object.assign(this.body.data, authData.toResp());
  },

  async createAuthData(props, maxAge) {
    const { logger, app } = this;
    const { redis } = app;

    props.maxAge = props.maxAge || maxAge || this.app.config.authToken.maxAge;
    props.maxAge = ms(props.maxAge);

    const authData = new AuthData(this, props);

    await redis.set(authData.authToken, JSON.stringify(authData.toJSON()), 'PX', authData.maxAge);

    logger.info(`redis 创建 authData ( ${authData.id} )数据 authToken: ${authData.authToken} 有效期 ${authData.maxAge}`);

    return authData;
  },

  async findAuthData(authToken) {
    const { logger, app } = this;
    const { redis } = app;

    if (!authToken) return;

    const authDataStr = await redis.get(authToken);
    if (!authDataStr) {
      logger.info(`redis 获取 authData 数据 authToken: ${authToken} 失败 不存在!`);
      return;
    }

    let authData = null;
    try {
      authData = JSON.parse(authDataStr);
    } catch (err) {
      logger.info(`authData 数据 解析错误: ${err.message} ${authDataStr}`);
      return;
    }

    if (!authData) {
      logger.info(`redis 获取 authData 数据 authToken: ${authToken} 为空！`);
      return;
    }

    return new AuthData(this, authData);
  },

  async destroyAuthData(authToken) {
    const { logger, app } = this;
    const { redis } = app;

    if (!authToken) return;

    await redis.del(authToken);

    logger.info(`删除 authToken: ${authToken} !`);
  },
};
