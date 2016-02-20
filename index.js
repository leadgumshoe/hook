'use strict';

var assert = require('assert');

var when = require('when');
var boom = require('boom');
var assign = require('lodash.assign');

function defaultValue(def, value){
  return (value != null ? value : def);
}

function handler(route, opts){
  var options = opts || {};

  assert(typeof options.webhook === 'function', 'Hook handler requires a `webhook` function option.');
  assert(typeof options.mapRequest === 'function', 'Hook handler requires a `mapRequest` function option.');

  function hookHandler(request, reply){
    var server = request.server;

    function inject(payload, req){
      if (req == null) {
        reply();
        return;
      }

      var injectOptions = {
        method: request.method,
        payload: payload,
        allowInternals: !!options.allowInternals
      };

      if (typeof req === 'string') {
        injectOptions.url = req;
      }

      if (typeof req === 'object') {
        assign(injectOptions, req);
      }

      server.inject(injectOptions, function(res){
        var result = res.result;

        if (result && result.error) {
          var err = boom.create(result.statusCode, result.message);
          reply(err);
        } else {
          reply(res.result).code(res.statusCode);
        }
      });
    }

    var webhookPayload = when(options.webhook(request)).fold(defaultValue, request);
    var requestOptions = webhookPayload.then(options.mapRequest);
    requestOptions.fold(inject, webhookPayload).catch(reply);
  }

  return hookHandler;
}

function hook(server, opts, done){

  server.handler('hook', handler);

  done();
}

hook.attributes = {
  pkg: require('./package.json')
};

module.exports = {
  register: hook
};
