'use strict';

var esprima, escodegen, _;

module.exports = function (code, catchbody) {
    esprima = esprima || require('esprima');
    escodegen = escodegen || require('escodegen');
    _ = _ || require('lodash');

    if (catchbody) {
        var ast = esprima.parse(catchbody);
        var asttemplate = _.template(JSON.stringify(ast));

        var catcher = function (fn_id) {
            return JSON.parse(asttemplate, { fn_id: id })
        }
    } else {
        var catcher = function () {
            return [];
        }
    }

    var ast = esprima.parse(code)

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

    parse(ast)

    _.each(fns, function (fn, index) {
        // move nested functions outside the body
        var nestedFns = [];

        _.each(fn.body.body, function (el) {
            if (isFn(el)) {
                nestedFns.push(el)
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
                            "name": "e"
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

    var result = escodegen.generate(ast);

    return result;
};
