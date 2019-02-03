'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _emailjsMimeCodec = require('emailjs-mime-codec');

var _emailjsMimeTypes = require('emailjs-mime-types');

var _utils = require('./utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Creates a new mime tree node. Assumes 'multipart/*' as the content type
 * if it is a branch, anything else counts as leaf. If rootNode is missing from
 * the options, assumes this is the root.
 *
 * @param {String} contentType Define the content type for the node. Can be left blank for attachments (derived from filename)
 * @param {Object} [options] optional options
 * @param {Object} [options.rootNode] root node for this tree
 * @param {Object} [options.parentNode] immediate parent for this node
 * @param {Object} [options.filename] filename for an attachment node
 * @param {String} [options.baseBoundary] shared part of the unique multipart boundary
 */
var MimeNode = function () {
  function MimeNode(contentType) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, MimeNode);

    this.nodeCounter = 0;

    /**
     * shared part of the unique multipart boundary
     */
    this.baseBoundary = options.baseBoundary || Date.now().toString() + Math.random();

    /**
     * If date headers is missing and current node is the root, this value is used instead
     */
    this.date = new Date();

    /**
     * Root node for current mime tree
     */
    this.rootNode = options.rootNode || this;

    /**
     * If filename is specified but contentType is not (probably an attachment)
     * detect the content type from filename extension
     */
    if (options.filename) {
      /**
       * Filename for this node. Useful with attachments
       */
      this.filename = options.filename;
      if (!contentType) {
        contentType = (0, _emailjsMimeTypes.detectMimeType)(this.filename.split('.').pop());
      }
    }

    /**
     * Immediate parent for this node (or undefined if not set)
     */
    this.parentNode = options.parentNode;

    /**
     * Used for generating unique boundaries (prepended to the shared base)
     */
    this._nodeId = ++this.rootNode.nodeCounter;

    /**
     * An array for possible child nodes
     */
    this._childNodes = [];

    /**
     * A list of header values for this node in the form of [{key:'', value:''}]
     */
    this._headers = [];

    /**
     * If content type is set (or derived from the filename) add it to headers
     */
    if (contentType) {
      this.setHeader('content-type', contentType);
    }

    /**
     * If true then BCC header is included in RFC2822 message.
     */
    this.includeBccInHeader = options.includeBccInHeader || false;

    /**
     * If true, then the Content-Transfer-Encoding is not applied to
     * the part when building.  Useful with an outgoing templating module
     * (e.g., for variable replacements) which will handle encoding.
     */
    this.skipContentEncoding = options.skipContentEncoding || false;
  }

  /**
   * Creates and appends a child node. Arguments provided are passed to MimeNode constructor
   *
   * @param {String} [contentType] Optional content type
   * @param {Object} [options] Optional options object
   * @return {Object} Created node object
   */


  _createClass(MimeNode, [{
    key: 'createChild',
    value: function createChild(contentType) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var node = new MimeNode(contentType, options);
      this.appendChild(node);
      return node;
    }

    /**
     * Appends an existing node to the mime tree. Removes the node from an existing
     * tree if needed
     *
     * @param {Object} childNode node to be appended
     * @return {Object} Appended node object
     */

  }, {
    key: 'appendChild',
    value: function appendChild(childNode) {
      if (childNode.rootNode !== this.rootNode) {
        childNode.rootNode = this.rootNode;
        childNode._nodeId = ++this.rootNode.nodeCounter;
      }

      childNode.parentNode = this;

      this._childNodes.push(childNode);
      return childNode;
    }

    /**
     * Replaces current node with another node
     *
     * @param {Object} node Replacement node
     * @return {Object} Replacement node
     */

  }, {
    key: 'replace',
    value: function replace(node) {
      var _this = this;

      if (node === this) {
        return this;
      }

      this.parentNode._childNodes.forEach(function (childNode, i) {
        if (childNode === _this) {
          node.rootNode = _this.rootNode;
          node.parentNode = _this.parentNode;
          node._nodeId = _this._nodeId;

          _this.rootNode = _this;
          _this.parentNode = undefined;

          node.parentNode._childNodes[i] = node;
        }
      });

      return node;
    }

    /**
     * Removes current node from the mime tree
     *
     * @return {Object} removed node
     */

  }, {
    key: 'remove',
    value: function remove() {
      if (!this.parentNode) {
        return this;
      }

      for (var i = this.parentNode._childNodes.length - 1; i >= 0; i--) {
        if (this.parentNode._childNodes[i] === this) {
          this.parentNode._childNodes.splice(i, 1);
          this.parentNode = undefined;
          this.rootNode = this;
          return this;
        }
      }
    }

    /**
     * Sets a header value. If the value for selected key exists, it is overwritten.
     * You can set multiple values as well by using [{key:'', value:''}] or
     * {key: 'value'} as the first argument.
     *
     * @param {String|Array|Object} key Header key or a list of key value pairs
     * @param {String} value Header value
     * @return {Object} current node
     */

  }, {
    key: 'setHeader',
    value: function setHeader(key, value) {
      var _this2 = this;

      var added = false;

      // Allow setting multiple headers at once
      if (!value && key && (typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
        if (key.key && key.value) {
          // allow {key:'content-type', value: 'text/plain'}
          this.setHeader(key.key, key.value);
        } else if (Array.isArray(key)) {
          // allow [{key:'content-type', value: 'text/plain'}]
          key.forEach(function (i) {
            return _this2.setHeader(i.key, i.value);
          });
        } else {
          // allow {'content-type': 'text/plain'}
          Object.keys(key).forEach(function (i) {
            return _this2.setHeader(i, key[i]);
          });
        }
        return this;
      }

      key = (0, _utils.normalizeHeaderKey)(key);

      var headerValue = { key: key, value: value

        // Check if the value exists and overwrite
      };for (var i = 0, len = this._headers.length; i < len; i++) {
        if (this._headers[i].key === key) {
          if (!added) {
            // replace the first match
            this._headers[i] = headerValue;
            added = true;
          } else {
            // remove following matches
            this._headers.splice(i, 1);
            i--;
            len--;
          }
        }
      }

      // match not found, append the value
      if (!added) {
        this._headers.push(headerValue);
      }

      return this;
    }

    /**
     * Adds a header value. If the value for selected key exists, the value is appended
     * as a new field and old one is not touched.
     * You can set multiple values as well by using [{key:'', value:''}] or
     * {key: 'value'} as the first argument.
     *
     * @param {String|Array|Object} key Header key or a list of key value pairs
     * @param {String} value Header value
     * @return {Object} current node
     */

  }, {
    key: 'addHeader',
    value: function addHeader(key, value) {
      var _this3 = this;

      // Allow setting multiple headers at once
      if (!value && key && (typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
        if (key.key && key.value) {
          // allow {key:'content-type', value: 'text/plain'}
          this.addHeader(key.key, key.value);
        } else if (Array.isArray(key)) {
          // allow [{key:'content-type', value: 'text/plain'}]
          key.forEach(function (i) {
            return _this3.addHeader(i.key, i.value);
          });
        } else {
          // allow {'content-type': 'text/plain'}
          Object.keys(key).forEach(function (i) {
            return _this3.addHeader(i, key[i]);
          });
        }
        return this;
      }

      this._headers.push({ key: (0, _utils.normalizeHeaderKey)(key), value: value });

      return this;
    }

    /**
     * Retrieves the first mathcing value of a selected key
     *
     * @param {String} key Key to search for
     * @retun {String} Value for the key
     */

  }, {
    key: 'getHeader',
    value: function getHeader(key) {
      key = (0, _utils.normalizeHeaderKey)(key);
      for (var i = 0, len = this._headers.length; i < len; i++) {
        if (this._headers[i].key === key) {
          return this._headers[i].value;
        }
      }
    }

    /**
     * Sets body content for current node. If the value is a string, charset is added automatically
     * to Content-Type (if it is text/*). If the value is a Typed Array, you need to specify
     * the charset yourself
     *
     * @param (String|Uint8Array) content Body content
     * @return {Object} current node
     */

  }, {
    key: 'setContent',
    value: function setContent(content) {
      this.content = content;
      return this;
    }

    /**
     * Builds the rfc2822 message from the current node. If this is a root node,
     * mandatory header fields are set if missing (Date, Message-Id, MIME-Version)
     *
     * @return {String} Compiled message
     */

  }, {
    key: 'build',
    value: function build() {
      var _this4 = this;

      var lines = [];
      var contentType = (this.getHeader('Content-Type') || '').toString().toLowerCase().trim();
      var transferEncoding = void 0;
      var flowed = void 0;

      if (this.content) {
        transferEncoding = (this.getHeader('Content-Transfer-Encoding') || '').toString().toLowerCase().trim();
        if (!transferEncoding || ['base64', 'quoted-printable'].indexOf(transferEncoding) < 0) {
          if (/^text\//i.test(contentType)) {
            // If there are no special symbols, no need to modify the text
            if ((0, _utils.isPlainText)(this.content)) {
              // If there are lines longer than 76 symbols/bytes, make the text 'flowed'
              if (/^.{77,}/m.test(this.content)) {
                flowed = true;
              }
              transferEncoding = '7bit';
            } else {
              transferEncoding = 'quoted-printable';
            }
          } else if (!/^multipart\//i.test(contentType)) {
            transferEncoding = transferEncoding || 'base64';
          }
        }

        if (transferEncoding) {
          this.setHeader('Content-Transfer-Encoding', transferEncoding);
        }
      }

      if (this.filename && !this.getHeader('Content-Disposition')) {
        this.setHeader('Content-Disposition', 'attachment');
      }

      this._headers.forEach(function (header) {
        var key = header.key;
        var value = header.value;
        var structured = void 0;

        switch (header.key) {
          case 'Content-Disposition':
            structured = (0, _emailjsMimeCodec.parseHeaderValue)(value);
            if (_this4.filename) {
              structured.params.filename = _this4.filename;
            }
            value = (0, _utils.buildHeaderValue)(structured);
            break;
          case 'Content-Type':
            structured = (0, _emailjsMimeCodec.parseHeaderValue)(value);

            _this4._addBoundary(structured);

            if (flowed) {
              structured.params.format = 'flowed';
            }
            if (String(structured.params.format).toLowerCase().trim() === 'flowed') {
              flowed = true;
            }

            if (structured.value.match(/^text\//) && typeof _this4.content === 'string' && /[\u0080-\uFFFF]/.test(_this4.content)) {
              structured.params.charset = 'utf-8';
            }

            value = (0, _utils.buildHeaderValue)(structured);
            break;
          case 'Bcc':
            if (_this4.includeBccInHeader === false) {
              // skip BCC values
              return;
            }
        }

        // skip empty lines
        value = (0, _utils.encodeHeaderValue)(key, value);
        if (!(value || '').toString().trim()) {
          return;
        }

        lines.push((0, _emailjsMimeCodec.foldLines)(key + ': ' + value));
      });

      // Ensure mandatory header fields
      if (this.rootNode === this) {
        if (!this.getHeader('Date')) {
          lines.push('Date: ' + this.date.toUTCString().replace(/GMT/, '+0000'));
        }
        // You really should define your own Message-Id field
        if (!this.getHeader('Message-Id')) {
          lines.push('Message-Id: <' +
          // crux to generate random strings like this:
          // "1401391905590-58aa8c32-d32a065c-c1a2aad2"
          [0, 0, 0].reduce(function (prev) {
            return prev + '-' + Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
          }, Date.now()) + '@' +
          // try to use the domain of the FROM address or fallback localhost
          (this.getEnvelope().from || 'localhost').split('@').pop() + '>');
        }
        if (!this.getHeader('MIME-Version')) {
          lines.push('MIME-Version: 1.0');
        }
      }
      lines.push('');

      if (this.content) {
        if (this.skipContentEncoding) {
          lines.push(this.content);
        } else {
          switch (transferEncoding) {
            case 'quoted-printable':
              lines.push((0, _emailjsMimeCodec.quotedPrintableEncode)(this.content));
              break;
            case 'base64':
              lines.push((0, _emailjsMimeCodec.base64Encode)(this.content, _typeof(this.content) === 'object' ? 'binary' : undefined));
              break;
            default:
              if (flowed) {
                // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
                lines.push((0, _emailjsMimeCodec.foldLines)(this.content.replace(/\r?\n/g, '\r\n').replace(/^( |From|>)/igm, ' $1'), 76, true));
              } else {
                lines.push(this.content.replace(/\r?\n/g, '\r\n'));
              }
          }
        }
        if (this.multipart) {
          lines.push('');
        }
      }

      if (this.multipart) {
        this._childNodes.forEach(function (node) {
          lines.push('--' + _this4.boundary);
          lines.push(node.build());
        });
        lines.push('--' + this.boundary + '--');
        lines.push('');
      }

      return lines.join('\r\n');
    }

    /**
     * Generates and returns SMTP envelope with the sender address and a list of recipients addresses
     *
     * @return {Object} SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
     */

  }, {
    key: 'getEnvelope',
    value: function getEnvelope() {
      var envelope = {
        from: false,
        to: []
      };
      this._headers.forEach(function (header) {
        var list = [];
        if (header.key === 'From' || !envelope.from && ['Reply-To', 'Sender'].indexOf(header.key) >= 0) {
          (0, _utils.convertAddresses)((0, _utils.parseAddresses)(header.value), list);
          if (list.length && list[0]) {
            envelope.from = list[0];
          }
        } else if (['To', 'Cc', 'Bcc'].indexOf(header.key) >= 0) {
          (0, _utils.convertAddresses)((0, _utils.parseAddresses)(header.value), envelope.to);
        }
      });

      return envelope;
    }

    /**
     * Checks if the content type is multipart and defines boundary if needed.
     * Doesn't return anything, modifies object argument instead.
     *
     * @param {Object} structured Parsed header value for 'Content-Type' key
     */

  }, {
    key: '_addBoundary',
    value: function _addBoundary(structured) {
      this.contentType = structured.value.trim().toLowerCase();

      this.multipart = this.contentType.split('/').reduce(function (prev, value) {
        return prev === 'multipart' ? value : false;
      });

      if (this.multipart) {
        this.boundary = structured.params.boundary = structured.params.boundary || this.boundary || (0, _utils.generateBoundary)(this._nodeId, this.rootNode.baseBoundary);
      } else {
        this.boundary = false;
      }
    }
  }]);

  return MimeNode;
}();

exports.default = MimeNode;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9idWlsZGVyLmpzIl0sIm5hbWVzIjpbIk1pbWVOb2RlIiwiY29udGVudFR5cGUiLCJvcHRpb25zIiwibm9kZUNvdW50ZXIiLCJiYXNlQm91bmRhcnkiLCJEYXRlIiwibm93IiwidG9TdHJpbmciLCJNYXRoIiwicmFuZG9tIiwiZGF0ZSIsInJvb3ROb2RlIiwiZmlsZW5hbWUiLCJzcGxpdCIsInBvcCIsInBhcmVudE5vZGUiLCJfbm9kZUlkIiwiX2NoaWxkTm9kZXMiLCJfaGVhZGVycyIsInNldEhlYWRlciIsImluY2x1ZGVCY2NJbkhlYWRlciIsInNraXBDb250ZW50RW5jb2RpbmciLCJub2RlIiwiYXBwZW5kQ2hpbGQiLCJjaGlsZE5vZGUiLCJwdXNoIiwiZm9yRWFjaCIsImkiLCJ1bmRlZmluZWQiLCJsZW5ndGgiLCJzcGxpY2UiLCJrZXkiLCJ2YWx1ZSIsImFkZGVkIiwiQXJyYXkiLCJpc0FycmF5IiwiT2JqZWN0Iiwia2V5cyIsImhlYWRlclZhbHVlIiwibGVuIiwiYWRkSGVhZGVyIiwiY29udGVudCIsImxpbmVzIiwiZ2V0SGVhZGVyIiwidG9Mb3dlckNhc2UiLCJ0cmltIiwidHJhbnNmZXJFbmNvZGluZyIsImZsb3dlZCIsImluZGV4T2YiLCJ0ZXN0IiwiaGVhZGVyIiwic3RydWN0dXJlZCIsInBhcmFtcyIsIl9hZGRCb3VuZGFyeSIsImZvcm1hdCIsIlN0cmluZyIsIm1hdGNoIiwiY2hhcnNldCIsInRvVVRDU3RyaW5nIiwicmVwbGFjZSIsInJlZHVjZSIsInByZXYiLCJmbG9vciIsInN1YnN0cmluZyIsImdldEVudmVsb3BlIiwiZnJvbSIsIm11bHRpcGFydCIsImJvdW5kYXJ5IiwiYnVpbGQiLCJqb2luIiwiZW52ZWxvcGUiLCJ0byIsImxpc3QiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7QUFNQTs7QUFDQTs7OztBQVVBOzs7Ozs7Ozs7Ozs7SUFZcUJBLFE7QUFDbkIsb0JBQWFDLFdBQWIsRUFBd0M7QUFBQSxRQUFkQyxP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QVdDLE1BQVgsQ0FBa0JlLFFBQWxCLElBQThCLEtBQUtBLFFBQW5DLElBQStDLDZCQUFpQixLQUFLbkQsT0FBdEIsRUFBK0IsS0FBS0wsUUFBTCxDQUFjUCxZQUE3QyxDQUE1RjtBQUNELE9BRkQsTUFFTztBQUNMLGFBQUsrRCxRQUFMLEdBQWdCLEtBQWhCO0FBQ0Q7QUFDRjs7Ozs7O2tCQTNja0JuRSxRIiwiZmlsZSI6ImJ1aWxkZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBiYXNlNjRFbmNvZGUsXG4gIHF1b3RlZFByaW50YWJsZUVuY29kZSxcbiAgZm9sZExpbmVzLFxuICBwYXJzZUhlYWRlclZhbHVlXG59IGZyb20gJ2VtYWlsanMtbWltZS1jb2RlYydcbmltcG9ydCB7IGRldGVjdE1pbWVUeXBlIH0gZnJvbSAnZW1haWxqcy1taW1lLXR5cGVzJ1xuaW1wb3J0IHtcbiAgY29udmVydEFkZHJlc3NlcyxcbiAgcGFyc2VBZGRyZXNzZXMsXG4gIGVuY29kZUhlYWRlclZhbHVlLFxuICBub3JtYWxpemVIZWFkZXJLZXksXG4gIGdlbmVyYXRlQm91bmRhcnksXG4gIGlzUGxhaW5UZXh0LFxuICBidWlsZEhlYWRlclZhbHVlXG59IGZyb20gJy4vdXRpbHMnXG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBtaW1lIHRyZWUgbm9kZS4gQXNzdW1lcyAnbXVsdGlwYXJ0LyonIGFzIHRoZSBjb250ZW50IHR5cGVcbiAqIGlmIGl0IGlzIGEgYnJhbmNoLCBhbnl0aGluZyBlbHNlIGNvdW50cyBhcyBsZWFmLiBJZiByb290Tm9kZSBpcyBtaXNzaW5nIGZyb21cbiAqIHRoZSBvcHRpb25zLCBhc3N1bWVzIHRoaXMgaXMgdGhlIHJvb3QuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnRUeXBlIERlZmluZSB0aGUgY29udGVudCB0eXBlIGZvciB0aGUgbm9kZS4gQ2FuIGJlIGxlZnQgYmxhbmsgZm9yIGF0dGFjaG1lbnRzIChkZXJpdmVkIGZyb20gZmlsZW5hbWUpXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIG9wdGlvbmFsIG9wdGlvbnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5yb290Tm9kZV0gcm9vdCBub2RlIGZvciB0aGlzIHRyZWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wYXJlbnROb2RlXSBpbW1lZGlhdGUgcGFyZW50IGZvciB0aGlzIG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5maWxlbmFtZV0gZmlsZW5hbWUgZm9yIGFuIGF0dGFjaG1lbnQgbm9kZVxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLmJhc2VCb3VuZGFyeV0gc2hhcmVkIHBhcnQgb2YgdGhlIHVuaXF1ZSBtdWx0aXBhcnQgYm91bmRhcnlcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWltZU5vZGUge1xuICBjb25zdHJ1Y3RvciAoY29udGVudFR5cGUsIG9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMubm9kZUNvdW50ZXIgPSAwXG5cbiAgICAvKipcbiAgICAgKiBzaGFyZWQgcGFydCBvZiB0aGUgdW5pcXVlIG11bHRpcGFydCBib3VuZGFyeVxuICAgICAqL1xuICAgIHRoaXMuYmFzZUJvdW5kYXJ5ID0gb3B0aW9ucy5iYXNlQm91bmRhcnkgfHwgRGF0ZS5ub3coKS50b1N0cmluZygpICsgTWF0aC5yYW5kb20oKVxuXG4gICAgLyoqXG4gICAgICogSWYgZGF0ZSBoZWFkZXJzIGlzIG1pc3NpbmcgYW5kIGN1cnJlbnQgbm9kZSBpcyB0aGUgcm9vdCwgdGhpcyB2YWx1ZSBpcyB1c2VkIGluc3RlYWRcbiAgICAgKi9cbiAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZSgpXG5cbiAgICAvKipcbiAgICAgKiBSb290IG5vZGUgZm9yIGN1cnJlbnQgbWltZSB0cmVlXG4gICAgICovXG4gICAgdGhpcy5yb290Tm9kZSA9IG9wdGlvbnMucm9vdE5vZGUgfHwgdGhpc1xuXG4gICAgLyoqXG4gICAgICogSWYgZmlsZW5hbWUgaXMgc3BlY2lmaWVkIGJ1dCBjb250ZW50VHlwZSBpcyBub3QgKHByb2JhYmx5IGFuIGF0dGFjaG1lbnQpXG4gICAgICogZGV0ZWN0IHRoZSBjb250ZW50IHR5cGUgZnJvbSBmaWxlbmFtZSBleHRlbnNpb25cbiAgICAgKi9cbiAgICBpZiAob3B0aW9ucy5maWxlbmFtZSkge1xuICAgICAgLyoqXG4gICAgICAgKiBGaWxlbmFtZSBmb3IgdGhpcyBub2RlLiBVc2VmdWwgd2l0aCBhdHRhY2htZW50c1xuICAgICAgICovXG4gICAgICB0aGlzLmZpbGVuYW1lID0gb3B0aW9ucy5maWxlbmFtZVxuICAgICAgaWYgKCFjb250ZW50VHlwZSkge1xuICAgICAgICBjb250ZW50VHlwZSA9IGRldGVjdE1pbWVUeXBlKHRoaXMuZmlsZW5hbWUuc3BsaXQoJy4nKS5wb3AoKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGUgcGFyZW50IGZvciB0aGlzIG5vZGUgKG9yIHVuZGVmaW5lZCBpZiBub3Qgc2V0KVxuICAgICAqL1xuICAgIHRoaXMucGFyZW50Tm9kZSA9IG9wdGlvbnMucGFyZW50Tm9kZVxuXG4gICAgLyoqXG4gICAgICogVXNlZCBmb3IgZ2VuZXJhdGluZyB1bmlxdWUgYm91bmRhcmllcyAocHJlcGVuZGVkIHRvIHRoZSBzaGFyZWQgYmFzZSlcbiAgICAgKi9cbiAgICB0aGlzLl9ub2RlSWQgPSArK3RoaXMucm9vdE5vZGUubm9kZUNvdW50ZXJcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IGZvciBwb3NzaWJsZSBjaGlsZCBub2Rlc1xuICAgICAqL1xuICAgIHRoaXMuX2NoaWxkTm9kZXMgPSBbXVxuXG4gICAgLyoqXG4gICAgICogQSBsaXN0IG9mIGhlYWRlciB2YWx1ZXMgZm9yIHRoaXMgbm9kZSBpbiB0aGUgZm9ybSBvZiBbe2tleTonJywgdmFsdWU6Jyd9XVxuICAgICAqL1xuICAgIHRoaXMuX2hlYWRlcnMgPSBbXVxuXG4gICAgLyoqXG4gICAgICogSWYgY29udGVudCB0eXBlIGlzIHNldCAob3IgZGVyaXZlZCBmcm9tIHRoZSBmaWxlbmFtZSkgYWRkIGl0IHRvIGhlYWRlcnNcbiAgICAgKi9cbiAgICBpZiAoY29udGVudFR5cGUpIHtcbiAgICAgIHRoaXMuc2V0SGVhZGVyKCdjb250ZW50LXR5cGUnLCBjb250ZW50VHlwZSlcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZW4gQkNDIGhlYWRlciBpcyBpbmNsdWRlZCBpbiBSRkMyODIyIG1lc3NhZ2UuXG4gICAgICovXG4gICAgdGhpcy5pbmNsdWRlQmNjSW5IZWFkZXIgPSBvcHRpb25zLmluY2x1ZGVCY2NJbkhlYWRlciB8fCBmYWxzZVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlbiB0aGUgQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZyBpcyBub3QgYXBwbGllZCB0b1xuICAgICAqIHRoZSBwYXJ0IHdoZW4gYnVpbGRpbmcuICBVc2VmdWwgd2l0aCBhbiBvdXRnb2luZyB0ZW1wbGF0aW5nIG1vZHVsZVxuICAgICAqIChlLmcuLCBmb3IgdmFyaWFibGUgcmVwbGFjZW1lbnRzKSB3aGljaCB3aWxsIGhhbmRsZSBlbmNvZGluZy5cbiAgICAgKi9cbiAgICB0aGlzLnNraXBDb250ZW50RW5jb2RpbmcgPSBvcHRpb25zLnNraXBDb250ZW50RW5jb2RpbmcgfHwgZmFsc2VcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuZCBhcHBlbmRzIGEgY2hpbGQgbm9kZS4gQXJndW1lbnRzIHByb3ZpZGVkIGFyZSBwYXNzZWQgdG8gTWltZU5vZGUgY29uc3RydWN0b3JcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtjb250ZW50VHlwZV0gT3B0aW9uYWwgY29udGVudCB0eXBlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBDcmVhdGVkIG5vZGUgb2JqZWN0XG4gICAqL1xuICBjcmVhdGVDaGlsZCAoY29udGVudFR5cGUsIG9wdGlvbnMgPSB7fSkge1xuICAgIHZhciBub2RlID0gbmV3IE1pbWVOb2RlKGNvbnRlbnRUeXBlLCBvcHRpb25zKVxuICAgIHRoaXMuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICByZXR1cm4gbm9kZVxuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYW4gZXhpc3Rpbmcgbm9kZSB0byB0aGUgbWltZSB0cmVlLiBSZW1vdmVzIHRoZSBub2RlIGZyb20gYW4gZXhpc3RpbmdcbiAgICogdHJlZSBpZiBuZWVkZWRcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkTm9kZSBub2RlIHRvIGJlIGFwcGVuZGVkXG4gICAqIEByZXR1cm4ge09iamVjdH0gQXBwZW5kZWQgbm9kZSBvYmplY3RcbiAgICovXG4gIGFwcGVuZENoaWxkIChjaGlsZE5vZGUpIHtcbiAgICBpZiAoY2hpbGROb2RlLnJvb3ROb2RlICE9PSB0aGlzLnJvb3ROb2RlKSB7XG4gICAgICBjaGlsZE5vZGUucm9vdE5vZGUgPSB0aGlzLnJvb3ROb2RlXG4gICAgICBjaGlsZE5vZGUuX25vZGVJZCA9ICsrdGhpcy5yb290Tm9kZS5ub2RlQ291bnRlclxuICAgIH1cblxuICAgIGNoaWxkTm9kZS5wYXJlbnROb2RlID0gdGhpc1xuXG4gICAgdGhpcy5fY2hpbGROb2Rlcy5wdXNoKGNoaWxkTm9kZSlcbiAgICByZXR1cm4gY2hpbGROb2RlXG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgY3VycmVudCBub2RlIHdpdGggYW5vdGhlciBub2RlXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBub2RlIFJlcGxhY2VtZW50IG5vZGVcbiAgICogQHJldHVybiB7T2JqZWN0fSBSZXBsYWNlbWVudCBub2RlXG4gICAqL1xuICByZXBsYWNlIChub2RlKSB7XG4gICAgaWYgKG5vZGUgPT09IHRoaXMpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgdGhpcy5wYXJlbnROb2RlLl9jaGlsZE5vZGVzLmZvckVhY2goKGNoaWxkTm9kZSwgaSkgPT4ge1xuICAgICAgaWYgKGNoaWxkTm9kZSA9PT0gdGhpcykge1xuICAgICAgICBub2RlLnJvb3ROb2RlID0gdGhpcy5yb290Tm9kZVxuICAgICAgICBub2RlLnBhcmVudE5vZGUgPSB0aGlzLnBhcmVudE5vZGVcbiAgICAgICAgbm9kZS5fbm9kZUlkID0gdGhpcy5fbm9kZUlkXG5cbiAgICAgICAgdGhpcy5yb290Tm9kZSA9IHRoaXNcbiAgICAgICAgdGhpcy5wYXJlbnROb2RlID0gdW5kZWZpbmVkXG5cbiAgICAgICAgbm9kZS5wYXJlbnROb2RlLl9jaGlsZE5vZGVzW2ldID0gbm9kZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gbm9kZVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgY3VycmVudCBub2RlIGZyb20gdGhlIG1pbWUgdHJlZVxuICAgKlxuICAgKiBAcmV0dXJuIHtPYmplY3R9IHJlbW92ZWQgbm9kZVxuICAgKi9cbiAgcmVtb3ZlICgpIHtcbiAgICBpZiAoIXRoaXMucGFyZW50Tm9kZSkge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gdGhpcy5wYXJlbnROb2RlLl9jaGlsZE5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5wYXJlbnROb2RlLl9jaGlsZE5vZGVzW2ldID09PSB0aGlzKSB7XG4gICAgICAgIHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5zcGxpY2UoaSwgMSlcbiAgICAgICAgdGhpcy5wYXJlbnROb2RlID0gdW5kZWZpbmVkXG4gICAgICAgIHRoaXMucm9vdE5vZGUgPSB0aGlzXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBoZWFkZXIgdmFsdWUuIElmIHRoZSB2YWx1ZSBmb3Igc2VsZWN0ZWQga2V5IGV4aXN0cywgaXQgaXMgb3ZlcndyaXR0ZW4uXG4gICAqIFlvdSBjYW4gc2V0IG11bHRpcGxlIHZhbHVlcyBhcyB3ZWxsIGJ5IHVzaW5nIFt7a2V5OicnLCB2YWx1ZTonJ31dIG9yXG4gICAqIHtrZXk6ICd2YWx1ZSd9IGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8T2JqZWN0fSBrZXkgSGVhZGVyIGtleSBvciBhIGxpc3Qgb2Yga2V5IHZhbHVlIHBhaXJzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBIZWFkZXIgdmFsdWVcbiAgICogQHJldHVybiB7T2JqZWN0fSBjdXJyZW50IG5vZGVcbiAgICovXG4gIHNldEhlYWRlciAoa2V5LCB2YWx1ZSkge1xuICAgIGxldCBhZGRlZCA9IGZhbHNlXG5cbiAgICAvLyBBbGxvdyBzZXR0aW5nIG11bHRpcGxlIGhlYWRlcnMgYXQgb25jZVxuICAgIGlmICghdmFsdWUgJiYga2V5ICYmIHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoa2V5LmtleSAmJiBrZXkudmFsdWUpIHtcbiAgICAgICAgLy8gYWxsb3cge2tleTonY29udGVudC10eXBlJywgdmFsdWU6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgdGhpcy5zZXRIZWFkZXIoa2V5LmtleSwga2V5LnZhbHVlKVxuICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGtleSkpIHtcbiAgICAgICAgLy8gYWxsb3cgW3trZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XVxuICAgICAgICBrZXkuZm9yRWFjaChpID0+IHRoaXMuc2V0SGVhZGVyKGkua2V5LCBpLnZhbHVlKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGFsbG93IHsnY29udGVudC10eXBlJzogJ3RleHQvcGxhaW4nfVxuICAgICAgICBPYmplY3Qua2V5cyhrZXkpLmZvckVhY2goaSA9PiB0aGlzLnNldEhlYWRlcihpLCBrZXlbaV0pKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBrZXkgPSBub3JtYWxpemVIZWFkZXJLZXkoa2V5KVxuXG4gICAgY29uc3QgaGVhZGVyVmFsdWUgPSB7IGtleSwgdmFsdWUgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHZhbHVlIGV4aXN0cyBhbmQgb3ZlcndyaXRlXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuX2hlYWRlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLl9oZWFkZXJzW2ldLmtleSA9PT0ga2V5KSB7XG4gICAgICAgIGlmICghYWRkZWQpIHtcbiAgICAgICAgICAvLyByZXBsYWNlIHRoZSBmaXJzdCBtYXRjaFxuICAgICAgICAgIHRoaXMuX2hlYWRlcnNbaV0gPSBoZWFkZXJWYWx1ZVxuICAgICAgICAgIGFkZGVkID0gdHJ1ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHJlbW92ZSBmb2xsb3dpbmcgbWF0Y2hlc1xuICAgICAgICAgIHRoaXMuX2hlYWRlcnMuc3BsaWNlKGksIDEpXG4gICAgICAgICAgaS0tXG4gICAgICAgICAgbGVuLS1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIG1hdGNoIG5vdCBmb3VuZCwgYXBwZW5kIHRoZSB2YWx1ZVxuICAgIGlmICghYWRkZWQpIHtcbiAgICAgIHRoaXMuX2hlYWRlcnMucHVzaChoZWFkZXJWYWx1ZSlcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBoZWFkZXIgdmFsdWUuIElmIHRoZSB2YWx1ZSBmb3Igc2VsZWN0ZWQga2V5IGV4aXN0cywgdGhlIHZhbHVlIGlzIGFwcGVuZGVkXG4gICAqIGFzIGEgbmV3IGZpZWxkIGFuZCBvbGQgb25lIGlzIG5vdCB0b3VjaGVkLlxuICAgKiBZb3UgY2FuIHNldCBtdWx0aXBsZSB2YWx1ZXMgYXMgd2VsbCBieSB1c2luZyBbe2tleTonJywgdmFsdWU6Jyd9XSBvclxuICAgKiB7a2V5OiAndmFsdWUnfSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0ga2V5IEhlYWRlciBrZXkgb3IgYSBsaXN0IG9mIGtleSB2YWx1ZSBwYWlyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBhZGRIZWFkZXIgKGtleSwgdmFsdWUpIHtcbiAgICAvLyBBbGxvdyBzZXR0aW5nIG11bHRpcGxlIGhlYWRlcnMgYXQgb25jZVxuICAgIGlmICghdmFsdWUgJiYga2V5ICYmIHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoa2V5LmtleSAmJiBrZXkudmFsdWUpIHtcbiAgICAgICAgLy8gYWxsb3cge2tleTonY29udGVudC10eXBlJywgdmFsdWU6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgdGhpcy5hZGRIZWFkZXIoa2V5LmtleSwga2V5LnZhbHVlKVxuICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGtleSkpIHtcbiAgICAgICAgLy8gYWxsb3cgW3trZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XVxuICAgICAgICBrZXkuZm9yRWFjaChpID0+IHRoaXMuYWRkSGVhZGVyKGkua2V5LCBpLnZhbHVlKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGFsbG93IHsnY29udGVudC10eXBlJzogJ3RleHQvcGxhaW4nfVxuICAgICAgICBPYmplY3Qua2V5cyhrZXkpLmZvckVhY2goaSA9PiB0aGlzLmFkZEhlYWRlcihpLCBrZXlbaV0pKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICB0aGlzLl9oZWFkZXJzLnB1c2goeyBrZXk6IG5vcm1hbGl6ZUhlYWRlcktleShrZXkpLCB2YWx1ZSB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGZpcnN0IG1hdGhjaW5nIHZhbHVlIG9mIGEgc2VsZWN0ZWQga2V5XG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgS2V5IHRvIHNlYXJjaCBmb3JcbiAgICogQHJldHVuIHtTdHJpbmd9IFZhbHVlIGZvciB0aGUga2V5XG4gICAqL1xuICBnZXRIZWFkZXIgKGtleSkge1xuICAgIGtleSA9IG5vcm1hbGl6ZUhlYWRlcktleShrZXkpXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2hlYWRlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLl9oZWFkZXJzW2ldLmtleSA9PT0ga2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWFkZXJzW2ldLnZhbHVlXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYm9keSBjb250ZW50IGZvciBjdXJyZW50IG5vZGUuIElmIHRoZSB2YWx1ZSBpcyBhIHN0cmluZywgY2hhcnNldCBpcyBhZGRlZCBhdXRvbWF0aWNhbGx5XG4gICAqIHRvIENvbnRlbnQtVHlwZSAoaWYgaXQgaXMgdGV4dC8qKS4gSWYgdGhlIHZhbHVlIGlzIGEgVHlwZWQgQXJyYXksIHlvdSBuZWVkIHRvIHNwZWNpZnlcbiAgICogdGhlIGNoYXJzZXQgeW91cnNlbGZcbiAgICpcbiAgICogQHBhcmFtIChTdHJpbmd8VWludDhBcnJheSkgY29udGVudCBCb2R5IGNvbnRlbnRcbiAgICogQHJldHVybiB7T2JqZWN0fSBjdXJyZW50IG5vZGVcbiAgICovXG4gIHNldENvbnRlbnQgKGNvbnRlbnQpIHtcbiAgICB0aGlzLmNvbnRlbnQgPSBjb250ZW50XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZHMgdGhlIHJmYzI4MjIgbWVzc2FnZSBmcm9tIHRoZSBjdXJyZW50IG5vZGUuIElmIHRoaXMgaXMgYSByb290IG5vZGUsXG4gICAqIG1hbmRhdG9yeSBoZWFkZXIgZmllbGRzIGFyZSBzZXQgaWYgbWlzc2luZyAoRGF0ZSwgTWVzc2FnZS1JZCwgTUlNRS1WZXJzaW9uKVxuICAgKlxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IENvbXBpbGVkIG1lc3NhZ2VcbiAgICovXG4gIGJ1aWxkICgpIHtcbiAgICBjb25zdCBsaW5lcyA9IFtdXG4gICAgY29uc3QgY29udGVudFR5cGUgPSAodGhpcy5nZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScpIHx8ICcnKS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkudHJpbSgpXG4gICAgbGV0IHRyYW5zZmVyRW5jb2RpbmdcbiAgICBsZXQgZmxvd2VkXG5cbiAgICBpZiAodGhpcy5jb250ZW50KSB7XG4gICAgICB0cmFuc2ZlckVuY29kaW5nID0gKHRoaXMuZ2V0SGVhZGVyKCdDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nJykgfHwgJycpLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS50cmltKClcbiAgICAgIGlmICghdHJhbnNmZXJFbmNvZGluZyB8fCBbJ2Jhc2U2NCcsICdxdW90ZWQtcHJpbnRhYmxlJ10uaW5kZXhPZih0cmFuc2ZlckVuY29kaW5nKSA8IDApIHtcbiAgICAgICAgaWYgKC9edGV4dFxcLy9pLnRlc3QoY29udGVudFR5cGUpKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIHNwZWNpYWwgc3ltYm9scywgbm8gbmVlZCB0byBtb2RpZnkgdGhlIHRleHRcbiAgICAgICAgICBpZiAoaXNQbGFpblRleHQodGhpcy5jb250ZW50KSkge1xuICAgICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIGxpbmVzIGxvbmdlciB0aGFuIDc2IHN5bWJvbHMvYnl0ZXMsIG1ha2UgdGhlIHRleHQgJ2Zsb3dlZCdcbiAgICAgICAgICAgIGlmICgvXi57NzcsfS9tLnRlc3QodGhpcy5jb250ZW50KSkge1xuICAgICAgICAgICAgICBmbG93ZWQgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFuc2ZlckVuY29kaW5nID0gJzdiaXQnXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyYW5zZmVyRW5jb2RpbmcgPSAncXVvdGVkLXByaW50YWJsZSdcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIS9ebXVsdGlwYXJ0XFwvL2kudGVzdChjb250ZW50VHlwZSkpIHtcbiAgICAgICAgICB0cmFuc2ZlckVuY29kaW5nID0gdHJhbnNmZXJFbmNvZGluZyB8fCAnYmFzZTY0J1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0cmFuc2ZlckVuY29kaW5nKSB7XG4gICAgICAgIHRoaXMuc2V0SGVhZGVyKCdDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nJywgdHJhbnNmZXJFbmNvZGluZylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5maWxlbmFtZSAmJiAhdGhpcy5nZXRIZWFkZXIoJ0NvbnRlbnQtRGlzcG9zaXRpb24nKSkge1xuICAgICAgdGhpcy5zZXRIZWFkZXIoJ0NvbnRlbnQtRGlzcG9zaXRpb24nLCAnYXR0YWNobWVudCcpXG4gICAgfVxuXG4gICAgdGhpcy5faGVhZGVycy5mb3JFYWNoKGhlYWRlciA9PiB7XG4gICAgICBjb25zdCBrZXkgPSBoZWFkZXIua2V5XG4gICAgICBsZXQgdmFsdWUgPSBoZWFkZXIudmFsdWVcbiAgICAgIGxldCBzdHJ1Y3R1cmVkXG5cbiAgICAgIHN3aXRjaCAoaGVhZGVyLmtleSkge1xuICAgICAgICBjYXNlICdDb250ZW50LURpc3Bvc2l0aW9uJzpcbiAgICAgICAgICBzdHJ1Y3R1cmVkID0gcGFyc2VIZWFkZXJWYWx1ZSh2YWx1ZSlcbiAgICAgICAgICBpZiAodGhpcy5maWxlbmFtZSkge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuZmlsZW5hbWUgPSB0aGlzLmZpbGVuYW1lXG4gICAgICAgICAgfVxuICAgICAgICAgIHZhbHVlID0gYnVpbGRIZWFkZXJWYWx1ZShzdHJ1Y3R1cmVkKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0NvbnRlbnQtVHlwZSc6XG4gICAgICAgICAgc3RydWN0dXJlZCA9IHBhcnNlSGVhZGVyVmFsdWUodmFsdWUpXG5cbiAgICAgICAgICB0aGlzLl9hZGRCb3VuZGFyeShzdHJ1Y3R1cmVkKVxuXG4gICAgICAgICAgaWYgKGZsb3dlZCkge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuZm9ybWF0ID0gJ2Zsb3dlZCdcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFN0cmluZyhzdHJ1Y3R1cmVkLnBhcmFtcy5mb3JtYXQpLnRvTG93ZXJDYXNlKCkudHJpbSgpID09PSAnZmxvd2VkJykge1xuICAgICAgICAgICAgZmxvd2VkID0gdHJ1ZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdHJ1Y3R1cmVkLnZhbHVlLm1hdGNoKC9edGV4dFxcLy8pICYmIHR5cGVvZiB0aGlzLmNvbnRlbnQgPT09ICdzdHJpbmcnICYmIC9bXFx1MDA4MC1cXHVGRkZGXS8udGVzdCh0aGlzLmNvbnRlbnQpKSB7XG4gICAgICAgICAgICBzdHJ1Y3R1cmVkLnBhcmFtcy5jaGFyc2V0ID0gJ3V0Zi04J1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhbHVlID0gYnVpbGRIZWFkZXJWYWx1ZShzdHJ1Y3R1cmVkKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0JjYyc6XG4gICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZUJjY0luSGVhZGVyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgLy8gc2tpcCBCQ0MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNraXAgZW1wdHkgbGluZXNcbiAgICAgIHZhbHVlID0gZW5jb2RlSGVhZGVyVmFsdWUoa2V5LCB2YWx1ZSlcbiAgICAgIGlmICghKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnRyaW0oKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbGluZXMucHVzaChmb2xkTGluZXMoa2V5ICsgJzogJyArIHZhbHVlKSlcbiAgICB9KVxuXG4gICAgLy8gRW5zdXJlIG1hbmRhdG9yeSBoZWFkZXIgZmllbGRzXG4gICAgaWYgKHRoaXMucm9vdE5vZGUgPT09IHRoaXMpIHtcbiAgICAgIGlmICghdGhpcy5nZXRIZWFkZXIoJ0RhdGUnKSkge1xuICAgICAgICBsaW5lcy5wdXNoKCdEYXRlOiAnICsgdGhpcy5kYXRlLnRvVVRDU3RyaW5nKCkucmVwbGFjZSgvR01ULywgJyswMDAwJykpXG4gICAgICB9XG4gICAgICAvLyBZb3UgcmVhbGx5IHNob3VsZCBkZWZpbmUgeW91ciBvd24gTWVzc2FnZS1JZCBmaWVsZFxuICAgICAgaWYgKCF0aGlzLmdldEhlYWRlcignTWVzc2FnZS1JZCcpKSB7XG4gICAgICAgIGxpbmVzLnB1c2goJ01lc3NhZ2UtSWQ6IDwnICtcbiAgICAgICAgICAvLyBjcnV4IHRvIGdlbmVyYXRlIHJhbmRvbSBzdHJpbmdzIGxpa2UgdGhpczpcbiAgICAgICAgICAvLyBcIjE0MDEzOTE5MDU1OTAtNThhYThjMzItZDMyYTA2NWMtYzFhMmFhZDJcIlxuICAgICAgICAgIFswLCAwLCAwXS5yZWR1Y2UoZnVuY3Rpb24gKHByZXYpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmV2ICsgJy0nICsgTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMDAwMDApXG4gICAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICAgICAgICAgICAgLnN1YnN0cmluZygxKVxuICAgICAgICAgIH0sIERhdGUubm93KCkpICtcbiAgICAgICAgICAnQCcgK1xuICAgICAgICAgIC8vIHRyeSB0byB1c2UgdGhlIGRvbWFpbiBvZiB0aGUgRlJPTSBhZGRyZXNzIG9yIGZhbGxiYWNrIGxvY2FsaG9zdFxuICAgICAgICAgICh0aGlzLmdldEVudmVsb3BlKCkuZnJvbSB8fCAnbG9jYWxob3N0Jykuc3BsaXQoJ0AnKS5wb3AoKSArXG4gICAgICAgICAgJz4nKVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLmdldEhlYWRlcignTUlNRS1WZXJzaW9uJykpIHtcbiAgICAgICAgbGluZXMucHVzaCgnTUlNRS1WZXJzaW9uOiAxLjAnKVxuICAgICAgfVxuICAgIH1cbiAgICBsaW5lcy5wdXNoKCcnKVxuXG4gICAgaWYgKHRoaXMuY29udGVudCkge1xuICAgICAgaWYgKHRoaXMuc2tpcENvbnRlbnRFbmNvZGluZykge1xuICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN3aXRjaCAodHJhbnNmZXJFbmNvZGluZykge1xuICAgICAgICAgIGNhc2UgJ3F1b3RlZC1wcmludGFibGUnOlxuICAgICAgICAgICAgbGluZXMucHVzaChxdW90ZWRQcmludGFibGVFbmNvZGUodGhpcy5jb250ZW50KSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgICAgIGxpbmVzLnB1c2goYmFzZTY0RW5jb2RlKHRoaXMuY29udGVudCwgdHlwZW9mIHRoaXMuY29udGVudCA9PT0gJ29iamVjdCcgPyAnYmluYXJ5JyA6IHVuZGVmaW5lZCkpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBpZiAoZmxvd2VkKSB7XG4gICAgICAgICAgICAgIC8vIHNwYWNlIHN0dWZmaW5nIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM2NzYjc2VjdGlvbi00LjJcbiAgICAgICAgICAgICAgbGluZXMucHVzaChmb2xkTGluZXModGhpcy5jb250ZW50LnJlcGxhY2UoL1xccj9cXG4vZywgJ1xcclxcbicpLnJlcGxhY2UoL14oIHxGcm9tfD4pL2lnbSwgJyAkMScpLCA3NiwgdHJ1ZSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHJcXG4nKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVsdGlwYXJ0KSB7XG4gICAgICAgIGxpbmVzLnB1c2goJycpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXVsdGlwYXJ0KSB7XG4gICAgICB0aGlzLl9jaGlsZE5vZGVzLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICAgIGxpbmVzLnB1c2goJy0tJyArIHRoaXMuYm91bmRhcnkpXG4gICAgICAgIGxpbmVzLnB1c2gobm9kZS5idWlsZCgpKVxuICAgICAgfSlcbiAgICAgIGxpbmVzLnB1c2goJy0tJyArIHRoaXMuYm91bmRhcnkgKyAnLS0nKVxuICAgICAgbGluZXMucHVzaCgnJylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxyXFxuJylcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYW5kIHJldHVybnMgU01UUCBlbnZlbG9wZSB3aXRoIHRoZSBzZW5kZXIgYWRkcmVzcyBhbmQgYSBsaXN0IG9mIHJlY2lwaWVudHMgYWRkcmVzc2VzXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH0gU01UUCBlbnZlbG9wZSBpbiB0aGUgZm9ybSBvZiB7ZnJvbTogJ2Zyb21AZXhhbXBsZS5jb20nLCB0bzogWyd0b0BleGFtcGxlLmNvbSddfVxuICAgKi9cbiAgZ2V0RW52ZWxvcGUgKCkge1xuICAgIHZhciBlbnZlbG9wZSA9IHtcbiAgICAgIGZyb206IGZhbHNlLFxuICAgICAgdG86IFtdXG4gICAgfVxuICAgIHRoaXMuX2hlYWRlcnMuZm9yRWFjaChoZWFkZXIgPT4ge1xuICAgICAgdmFyIGxpc3QgPSBbXVxuICAgICAgaWYgKGhlYWRlci5rZXkgPT09ICdGcm9tJyB8fCAoIWVudmVsb3BlLmZyb20gJiYgWydSZXBseS1UbycsICdTZW5kZXInXS5pbmRleE9mKGhlYWRlci5rZXkpID49IDApKSB7XG4gICAgICAgIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXMoaGVhZGVyLnZhbHVlKSwgbGlzdClcbiAgICAgICAgaWYgKGxpc3QubGVuZ3RoICYmIGxpc3RbMF0pIHtcbiAgICAgICAgICBlbnZlbG9wZS5mcm9tID0gbGlzdFswXVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKFsnVG8nLCAnQ2MnLCAnQmNjJ10uaW5kZXhPZihoZWFkZXIua2V5KSA+PSAwKSB7XG4gICAgICAgIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXMoaGVhZGVyLnZhbHVlKSwgZW52ZWxvcGUudG8pXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBlbnZlbG9wZVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgY29udGVudCB0eXBlIGlzIG11bHRpcGFydCBhbmQgZGVmaW5lcyBib3VuZGFyeSBpZiBuZWVkZWQuXG4gICAqIERvZXNuJ3QgcmV0dXJuIGFueXRoaW5nLCBtb2RpZmllcyBvYmplY3QgYXJndW1lbnQgaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0cnVjdHVyZWQgUGFyc2VkIGhlYWRlciB2YWx1ZSBmb3IgJ0NvbnRlbnQtVHlwZScga2V5XG4gICAqL1xuICBfYWRkQm91bmRhcnkgKHN0cnVjdHVyZWQpIHtcbiAgICB0aGlzLmNvbnRlbnRUeXBlID0gc3RydWN0dXJlZC52YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuXG4gICAgdGhpcy5tdWx0aXBhcnQgPSB0aGlzLmNvbnRlbnRUeXBlLnNwbGl0KCcvJykucmVkdWNlKGZ1bmN0aW9uIChwcmV2LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIHByZXYgPT09ICdtdWx0aXBhcnQnID8gdmFsdWUgOiBmYWxzZVxuICAgIH0pXG5cbiAgICBpZiAodGhpcy5tdWx0aXBhcnQpIHtcbiAgICAgIHRoaXMuYm91bmRhcnkgPSBzdHJ1Y3R1cmVkLnBhcmFtcy5ib3VuZGFyeSA9IHN0cnVjdHVyZWQucGFyYW1zLmJvdW5kYXJ5IHx8IHRoaXMuYm91bmRhcnkgfHwgZ2VuZXJhdGVCb3VuZGFyeSh0aGlzLl9ub2RlSWQsIHRoaXMucm9vdE5vZGUuYmFzZUJvdW5kYXJ5KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJvdW5kYXJ5ID0gZmFsc2VcbiAgICB9XG4gIH1cbn1cbiJdfQ==