'use strict';

var esprima, escodegen, _;

module.exports = function (code, catchbody, module) {
    esprima = esprima || require('esprima');
    escodegen = escodegen || require('escodegen');
    _ = _ || require('lodash');

    _.templateSettings = {
        evaluate:    /\{\{#([\s\S]+?)\}\}/g,            // {{# console.log("blah") }}
        interpolate: /\{\{[^#\{]([\s\S]+?)[^\}]\}\}/g,  // {{ title }}
        escape:      /\{\{\{([\s\S]+?)\}\}\}/g,         // {{{ title }}}
    }

    if (catchbody) {
        var astbody = JSON.stringify(esprima.parseScript(catchbody).body);
        var catcher = function (fn_id) {
            return JSON.parse(astbody.replace('{{fn_id}}', fn_id));
        }
    } else {
        var catcher = function () {
            return [];
        }
    }

    var root = module ? esprima.parseModule(code) : esprima.parseScript(code)

    var fns = []

    function isFn(el) {
        return el instanceof Object && !(el instanceof Array) &&
               (el.type === 'FunctionDeclaration' || el.type === 'FunctionExpression');
    }

    function parse(root) {
        _.each(root, function (el) {
            if (isFn(el)) fns.push(el)
            if (el instanceof Object) parse(el);
        })
    }

    parse(root)

    _.each(fns, function (fn, index) {
        // move nested functions outside the body
        var nestedFns = [];

        _.each(fn.body.body, function (el) {
            if (isFn(el)) {
                nestedFns.push(el);
                fn.body.body = _.without(fn.body.body, el);
            };
        })

        fn.body.body = nestedFns.concat([
            {
                "type": "TryStatement",
                "block": {
                    "type": "BlockStatement",
                    "body": fn.body.body
                },
                "guardedHandlers": [],
                "handlers": [
                    {
                        "type": "CatchClause",
                        "param": {
                            "type": "Identifier",
                            "name": "jswrap_exception"
                        },
                        "body": {
                            "type": "BlockStatement",
                            "body": catcher(index)
                        }
                    }
                ],
                "finalizer": null
            }
        ]);
    });

    var result = escodegen.generate(root);

    return result;
};
