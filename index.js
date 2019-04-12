const convert = require('koa-convert');
const Resource = require('koa-resource-router');
const checkPermission = require("unloop-check-permission").roles;

const wrapExport = (exp, permissions, entryPoint) =>
    function*(next) {
        if (permissions) {
            if (!checkPermission(this, permissions.default) || !checkPermission(this, permissions[entryPoint])) {
                this.throw(403, "Not Authorized");
            }
        }

        yield convert.back(exp[entryPoint]);
    }

module.exports = (basePath) => (...middleware) => (entity) => {

    const resourceModule = require(`${basePath}/resources/${entity}.js`);
    const importedResorce = resourceModule(require(`${basePath}/entity/${entity}.js`));

    const builtResource = {};
    for(let entryPoint in importedResorce) {
        builtResource[entryPoint] = wrapExport(importedResorce, resourceModule.permissions, entryPoint);
    }

    const resource = new Resource(entity, ...middleware.map((m) => convert.back(m)), builtResource);
    resource.middleware = convert(resource.middleware);

    return resource;
}
