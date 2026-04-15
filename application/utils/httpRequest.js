const axios = require('axios');
const qs = require('querystring');

class HttpRequest {
    constructor(req = null, res = null) {
        this.req = req;
        this.res = res;
        this.jsonData = {};
        this.baseURL = null;
    }

    setReq(req) { this.req = req; return this; }
    setRes(res) { this.res = res; return this; }
    setBaseURL(url) { this.baseURL = url; return this; }
    setJson(key, value) { this.jsonData[key] = value; return this; }

    set(object) {
        if (object.req) this.setReq(object.req);
        if (object.res) this.setRes(object.res);
        if (object.json) {
            for (const [key, value] of Object.entries(object.json)) {
                this.setJson(key, value);
            }
        }
        return this;
    }

    getPost(key = null) {
        if (!this.req || !this.req.body) return null;
        return key ? this.req.body[key] : this.req.body;
    }

    getQuery(key = null) {
        if (!this.req || !this.req.query) return null;
        return key ? this.req.query[key] : this.req.query;
    }

    getGet(key = null) { return this.getQuery(key); }
    getParam(key = null) { return this.req?.params ? (key ? this.req.params[key] : this.req.params) : null; }
    getHeader(key = null) { return key ? this.req?.headers?.[key.toLowerCase()] || null : this.req?.headers; }

    getCookie(key = null) { return this.req?.cookies ? (key ? this.req.cookies[key] : this.req.cookies) : null; }
    getJSON(key = null) { return this.req?.body ? (key ? this.req.body[key] : this.req.body) : this.jsonData; }
    all() { return { ...(this.req?.query || {}), ...(this.req?.body || {}) }; }

    json(statusCode = 200, data = {}) {
        if (!data || Object.keys(data).length === 0) data = this.jsonData;
        if (!this.res) throw new Error("Express res object not provided to HttpRequest");
        if (data.statusCode) {
            statusCode = statusCode;
        }
        return this.res.status(statusCode).json(data);
    }

    returnJson(statusCode = 200, data = {}) {
        return this.json(statusCode, data);
    }

    /** -------------------- HTTP METHODS -------------------- */
    async getData(url, params = {}, config = {}) {
        if (this.baseURL) {
            url = `${this.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
        }
        try {
            const res = await axios.get(url, { params, ...config });
            return res.data;
        } catch (err) {
            return this._handleAxiosError(err);
        }
    }

    async postData(url, data = {}, config = {}) {
        if (this.baseURL) {
            url = `${this.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
        }
        try {
            const res = await axios.post(url, qs.stringify(data), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                ...config
            });
            return res.data;
        } catch (err) {
            return this._handleAxiosError(err);
        }
    }

    async postBody(url, data = {}, config = {}) {
        if (this.baseURL) {
            url = `${this.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
        }
        try {
            const res = await axios.post(url, data, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.headers || {})
                },
                ...config
            });
            return res.data;
        } catch (err) {
            return this._handleAxiosError(err);
        }
    }

    async post(url, data = {}, config = {},type='body'){
        return type.toLocaleLowerCase === 'body' ? 
        await this.postBody(url,data,config) :
        await this.postData(url,data,config);
    }

    _handleAxiosError(err) {
        if (err.response) return { error: err.response.data, status: err.response.status };
        return { error: err.message };
    }

    /** -------------------- COOKIE METHODS -------------------- */
    setCookie(name, value, options = { httpOnly: true }) {
        if (!this.res) throw new Error("Express res object not set for HttpRequest");
        this.res.cookie(name, value, options);
    }

    deleteCookie(name, options = {}) {
        if (!this.res) throw new Error("Express res object not set for HttpRequest");
        this.res.clearCookie(name, options);
    }

    clearCookies() {
        if (!this.req || !this.res) throw new Error("Both req and res must be set to clear cookies");
        if (!this.req.cookies) return;
        Object.keys(this.req.cookies).forEach(name => this.res.clearCookie(name));
    }
}

module.exports = HttpRequest;