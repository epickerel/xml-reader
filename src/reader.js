'use strict';

const EventEmitter = require('eventemitter3');
const Lexer = require('xml-lexer-datatest');
const Type = Lexer.Type;

const NodeType = {
    element: 'element',
    text: 'text',
};

const createNode = (params) => Object.assign({
    name: '',
    type: NodeType.element,
    value: '',
    parent: null,
    attributes: {},
    children: [],
}, params);

const create = (options) => {
    options = Object.assign({
        stream: false,
        parentNodes: true,
        doneEvent: 'done',
        tagPrefix: 'tag:',
        emitTopLevelOnly: false,
        debug: false,
    }, options);

    let lexer, rootNode, current, attrName;

    const reader = new EventEmitter();

    const handleLexerData = (data) => {
        switch (data.type) {

            case Type.openTag:
                if (current === null) {
                    current = rootNode;
                    current.name = data.value;
                } else {
                    const node = createNode({
                        name: data.value,
                        parent: current
                    });
                    current.children.push(node);
                    current = node;
                }
                break;

            case Type.closeTag:
                const parent = current.parent;
                if (!options.parentNodes) {
                    current.parent = null;
                }
                if (current.name !== data.value) {
                    // ignore unexpected closing tag
                    break;
                }
                if (options.stream && parent === rootNode) {
                    rootNode.children = [];
                    // do not expose parent node in top level nodes
                    current.parent = null;
                }
                if (!options.emitTopLevelOnly || parent === rootNode) {
                    reader.emit(options.tagPrefix + current.name, current);
                    reader.emit('tag', current.name, current);
                }
                if (current === rootNode) {
                    // end of document, stop listening
                    lexer.removeAllListeners('data');
                    reader.emit(options.doneEvent, current);
                    rootNode = null;
                }
                current = parent;
                break;

            case Type.text:
                if (current) {
                    current.children.push(createNode({
                        type: NodeType.text,
                        value: data.value,
                        parent: options.parentNodes ? current : null
                    }));
                }
                break;

            case Type.attributeName:
                attrName = data.value;
                current.attributes[attrName] = '';
                break;

            case Type.attributeValue:
                current.attributes[attrName] = data.value;
                break;
        }
    };

    reader.reset = () => {
        var lexerOptions = {
            debug: options.debug
        };
        if (options.dataEmitTest) {
            lexerOptions.dataEmitTest = options.dataEmitTest;
        }
        lexer = Lexer.create(lexerOptions);
        lexer.on('data', handleLexerData);
        rootNode = createNode();
        current = null;
        attrName = '';
        reader.parse = lexer.write;
    };

    reader.reset();
    return reader;
};

const parseSync = (xml, options) => {
    options = Object.assign({}, options, {stream: false, tagPrefix: ':'});
    const reader = create(options);
    let res;
    reader.on('done', ast => {res = ast});
    reader.parse(xml);
    return res;
};

module.exports = {
    parseSync,
    create,
    NodeType,
};
