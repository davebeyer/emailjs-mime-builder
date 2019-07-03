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
            if (_this4.filename /* consider: && structured.value === 'attachment' */) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9idWlsZGVyLmpzIl0sIm5hbWVzIjpbIk1pbWVOb2RlIiwiY29udGVudFR5cGUiLCJvcHRpb25zIiwibm9kZUNvdW50ZXIiLCJiYXNlQm91bmRhcnkiLCJEYXRlIiwibm93IiwidG9TdHJpbmciLCJNYXRoIiwicmFuZG9tIiwiZGF0ZSIsInJvb3ROb2RlIiwiZmlsZW5hbWUiLCJzcGxpdCIsInBvcCIsInBhcmVudE5vZGUiLCJfbm9kZUlkIiwiX2NoaWxkTm9kZXMiLCJfaGVhZGVycyIsInNldEhlYWRlciIsImluY2x1ZGVCY2NJbkhlYWRlciIsInNraXBDb250ZW50RW5jb2RpbmciLCJub2RlIiwiYXBwZW5kQ2hpbGQiLCJjaGlsZE5vZGUiLCJwdXNoIiwiZm9yRWFjaCIsImkiLCJ1bmRlZmluZWQiLCJsZW5ndGgiLCJzcGxpY2UiLCJrZXkiLCJ2YWx1ZSIsImFkZGVkIiwiQXJyYXkiLCJpc0FycmF5IiwiT2JqZWN0Iiwia2V5cyIsImhlYWRlclZhbHVlIiwibGVuIiwiYWRkSGVhZGVyIiwiY29udGVudCIsImxpbmVzIiwiZ2V0SGVhZGVyIiwidG9Mb3dlckNhc2UiLCJ0cmltIiwidHJhbnNmZXJFbmNvZGluZyIsImZsb3dlZCIsImluZGV4T2YiLCJ0ZXN0IiwiaGVhZGVyIiwic3RydWN0dXJlZCIsInBhcmFtcyIsIl9hZGRCb3VuZGFyeSIsImZvcm1hdCIsIlN0cmluZyIsIm1hdGNoIiwiY2hhcnNldCIsInRvVVRDU3RyaW5nIiwicmVwbGFjZSIsInJlZHVjZSIsInByZXYiLCJmbG9vciIsInN1YnN0cmluZyIsImdldEVudmVsb3BlIiwiZnJvbSIsIm11bHRpcGFydCIsImJvdW5kYXJ5IiwiYnVpbGQiLCJqb2luIiwiZW52ZWxvcGUiLCJ0byIsImxpc3QiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7QUFNQTs7QUFDQTs7OztBQVVBOzs7Ozs7Ozs7Ozs7SUFZcUJBLFE7QUFDbkIsb0JBQWFDLFdBQWIsRUFBd0M7QUFBQSxRQUFkQyxP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bEIsR0FBNkJoQixXQUFXQyxNQUFYLENBQWtCZSxRQUFsQixJQUE4QixLQUFLQSxRQUFuQyxJQUErQyw2QkFBaUIsS0FBS25ELE9BQXRCLEVBQStCLEtBQUtMLFFBQUwsQ0FBY1AsWUFBN0MsQ0FBNUY7QUFDRCxPQUZELE1BRU87QUFDTCxhQUFLK0QsUUFBTCxHQUFnQixLQUFoQjtBQUNEO0FBQ0Y7Ozs7OztrQkEzY2tCbkUsUSIsImZpbGUiOiJidWlsZGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgYmFzZTY0RW5jb2RlLFxuICBxdW90ZWRQcmludGFibGVFbmNvZGUsXG4gIGZvbGRMaW5lcyxcbiAgcGFyc2VIZWFkZXJWYWx1ZVxufSBmcm9tICdlbWFpbGpzLW1pbWUtY29kZWMnXG5pbXBvcnQgeyBkZXRlY3RNaW1lVHlwZSB9IGZyb20gJ2VtYWlsanMtbWltZS10eXBlcydcbmltcG9ydCB7XG4gIGNvbnZlcnRBZGRyZXNzZXMsXG4gIHBhcnNlQWRkcmVzc2VzLFxuICBlbmNvZGVIZWFkZXJWYWx1ZSxcbiAgbm9ybWFsaXplSGVhZGVyS2V5LFxuICBnZW5lcmF0ZUJvdW5kYXJ5LFxuICBpc1BsYWluVGV4dCxcbiAgYnVpbGRIZWFkZXJWYWx1ZVxufSBmcm9tICcuL3V0aWxzJ1xuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgbWltZSB0cmVlIG5vZGUuIEFzc3VtZXMgJ211bHRpcGFydC8qJyBhcyB0aGUgY29udGVudCB0eXBlXG4gKiBpZiBpdCBpcyBhIGJyYW5jaCwgYW55dGhpbmcgZWxzZSBjb3VudHMgYXMgbGVhZi4gSWYgcm9vdE5vZGUgaXMgbWlzc2luZyBmcm9tXG4gKiB0aGUgb3B0aW9ucywgYXNzdW1lcyB0aGlzIGlzIHRoZSByb290LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50VHlwZSBEZWZpbmUgdGhlIGNvbnRlbnQgdHlwZSBmb3IgdGhlIG5vZGUuIENhbiBiZSBsZWZ0IGJsYW5rIGZvciBhdHRhY2htZW50cyAoZGVyaXZlZCBmcm9tIGZpbGVuYW1lKVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBvcHRpb25hbCBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucm9vdE5vZGVdIHJvb3Qgbm9kZSBmb3IgdGhpcyB0cmVlXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucGFyZW50Tm9kZV0gaW1tZWRpYXRlIHBhcmVudCBmb3IgdGhpcyBub2RlXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMuZmlsZW5hbWVdIGZpbGVuYW1lIGZvciBhbiBhdHRhY2htZW50IG5vZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbb3B0aW9ucy5iYXNlQm91bmRhcnldIHNoYXJlZCBwYXJ0IG9mIHRoZSB1bmlxdWUgbXVsdGlwYXJ0IGJvdW5kYXJ5XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1pbWVOb2RlIHtcbiAgY29uc3RydWN0b3IgKGNvbnRlbnRUeXBlLCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLm5vZGVDb3VudGVyID0gMFxuXG4gICAgLyoqXG4gICAgICogc2hhcmVkIHBhcnQgb2YgdGhlIHVuaXF1ZSBtdWx0aXBhcnQgYm91bmRhcnlcbiAgICAgKi9cbiAgICB0aGlzLmJhc2VCb3VuZGFyeSA9IG9wdGlvbnMuYmFzZUJvdW5kYXJ5IHx8IERhdGUubm93KCkudG9TdHJpbmcoKSArIE1hdGgucmFuZG9tKClcblxuICAgIC8qKlxuICAgICAqIElmIGRhdGUgaGVhZGVycyBpcyBtaXNzaW5nIGFuZCBjdXJyZW50IG5vZGUgaXMgdGhlIHJvb3QsIHRoaXMgdmFsdWUgaXMgdXNlZCBpbnN0ZWFkXG4gICAgICovXG4gICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKVxuXG4gICAgLyoqXG4gICAgICogUm9vdCBub2RlIGZvciBjdXJyZW50IG1pbWUgdHJlZVxuICAgICAqL1xuICAgIHRoaXMucm9vdE5vZGUgPSBvcHRpb25zLnJvb3ROb2RlIHx8IHRoaXNcblxuICAgIC8qKlxuICAgICAqIElmIGZpbGVuYW1lIGlzIHNwZWNpZmllZCBidXQgY29udGVudFR5cGUgaXMgbm90IChwcm9iYWJseSBhbiBhdHRhY2htZW50KVxuICAgICAqIGRldGVjdCB0aGUgY29udGVudCB0eXBlIGZyb20gZmlsZW5hbWUgZXh0ZW5zaW9uXG4gICAgICovXG4gICAgaWYgKG9wdGlvbnMuZmlsZW5hbWUpIHtcbiAgICAgIC8qKlxuICAgICAgICogRmlsZW5hbWUgZm9yIHRoaXMgbm9kZS4gVXNlZnVsIHdpdGggYXR0YWNobWVudHNcbiAgICAgICAqL1xuICAgICAgdGhpcy5maWxlbmFtZSA9IG9wdGlvbnMuZmlsZW5hbWVcbiAgICAgIGlmICghY29udGVudFR5cGUpIHtcbiAgICAgICAgY29udGVudFR5cGUgPSBkZXRlY3RNaW1lVHlwZSh0aGlzLmZpbGVuYW1lLnNwbGl0KCcuJykucG9wKCkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlIHBhcmVudCBmb3IgdGhpcyBub2RlIChvciB1bmRlZmluZWQgaWYgbm90IHNldClcbiAgICAgKi9cbiAgICB0aGlzLnBhcmVudE5vZGUgPSBvcHRpb25zLnBhcmVudE5vZGVcblxuICAgIC8qKlxuICAgICAqIFVzZWQgZm9yIGdlbmVyYXRpbmcgdW5pcXVlIGJvdW5kYXJpZXMgKHByZXBlbmRlZCB0byB0aGUgc2hhcmVkIGJhc2UpXG4gICAgICovXG4gICAgdGhpcy5fbm9kZUlkID0gKyt0aGlzLnJvb3ROb2RlLm5vZGVDb3VudGVyXG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBmb3IgcG9zc2libGUgY2hpbGQgbm9kZXNcbiAgICAgKi9cbiAgICB0aGlzLl9jaGlsZE5vZGVzID0gW11cblxuICAgIC8qKlxuICAgICAqIEEgbGlzdCBvZiBoZWFkZXIgdmFsdWVzIGZvciB0aGlzIG5vZGUgaW4gdGhlIGZvcm0gb2YgW3trZXk6JycsIHZhbHVlOicnfV1cbiAgICAgKi9cbiAgICB0aGlzLl9oZWFkZXJzID0gW11cblxuICAgIC8qKlxuICAgICAqIElmIGNvbnRlbnQgdHlwZSBpcyBzZXQgKG9yIGRlcml2ZWQgZnJvbSB0aGUgZmlsZW5hbWUpIGFkZCBpdCB0byBoZWFkZXJzXG4gICAgICovXG4gICAgaWYgKGNvbnRlbnRUeXBlKSB7XG4gICAgICB0aGlzLnNldEhlYWRlcignY29udGVudC10eXBlJywgY29udGVudFR5cGUpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGVuIEJDQyBoZWFkZXIgaXMgaW5jbHVkZWQgaW4gUkZDMjgyMiBtZXNzYWdlLlxuICAgICAqL1xuICAgIHRoaXMuaW5jbHVkZUJjY0luSGVhZGVyID0gb3B0aW9ucy5pbmNsdWRlQmNjSW5IZWFkZXIgfHwgZmFsc2VcblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZW4gdGhlIENvbnRlbnQtVHJhbnNmZXItRW5jb2RpbmcgaXMgbm90IGFwcGxpZWQgdG9cbiAgICAgKiB0aGUgcGFydCB3aGVuIGJ1aWxkaW5nLiAgVXNlZnVsIHdpdGggYW4gb3V0Z29pbmcgdGVtcGxhdGluZyBtb2R1bGVcbiAgICAgKiAoZS5nLiwgZm9yIHZhcmlhYmxlIHJlcGxhY2VtZW50cykgd2hpY2ggd2lsbCBoYW5kbGUgZW5jb2RpbmcuXG4gICAgICovXG4gICAgdGhpcy5za2lwQ29udGVudEVuY29kaW5nID0gb3B0aW9ucy5za2lwQ29udGVudEVuY29kaW5nIHx8IGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmQgYXBwZW5kcyBhIGNoaWxkIG5vZGUuIEFyZ3VtZW50cyBwcm92aWRlZCBhcmUgcGFzc2VkIHRvIE1pbWVOb2RlIGNvbnN0cnVjdG9yXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbY29udGVudFR5cGVdIE9wdGlvbmFsIGNvbnRlbnQgdHlwZVxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0XG4gICAqIEByZXR1cm4ge09iamVjdH0gQ3JlYXRlZCBub2RlIG9iamVjdFxuICAgKi9cbiAgY3JlYXRlQ2hpbGQgKGNvbnRlbnRUeXBlLCBvcHRpb25zID0ge30pIHtcbiAgICB2YXIgbm9kZSA9IG5ldyBNaW1lTm9kZShjb250ZW50VHlwZSwgb3B0aW9ucylcbiAgICB0aGlzLmFwcGVuZENoaWxkKG5vZGUpXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBlbmRzIGFuIGV4aXN0aW5nIG5vZGUgdG8gdGhlIG1pbWUgdHJlZS4gUmVtb3ZlcyB0aGUgbm9kZSBmcm9tIGFuIGV4aXN0aW5nXG4gICAqIHRyZWUgaWYgbmVlZGVkXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZE5vZGUgbm9kZSB0byBiZSBhcHBlbmRlZFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IEFwcGVuZGVkIG5vZGUgb2JqZWN0XG4gICAqL1xuICBhcHBlbmRDaGlsZCAoY2hpbGROb2RlKSB7XG4gICAgaWYgKGNoaWxkTm9kZS5yb290Tm9kZSAhPT0gdGhpcy5yb290Tm9kZSkge1xuICAgICAgY2hpbGROb2RlLnJvb3ROb2RlID0gdGhpcy5yb290Tm9kZVxuICAgICAgY2hpbGROb2RlLl9ub2RlSWQgPSArK3RoaXMucm9vdE5vZGUubm9kZUNvdW50ZXJcbiAgICB9XG5cbiAgICBjaGlsZE5vZGUucGFyZW50Tm9kZSA9IHRoaXNcblxuICAgIHRoaXMuX2NoaWxkTm9kZXMucHVzaChjaGlsZE5vZGUpXG4gICAgcmV0dXJuIGNoaWxkTm9kZVxuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGN1cnJlbnQgbm9kZSB3aXRoIGFub3RoZXIgbm9kZVxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gbm9kZSBSZXBsYWNlbWVudCBub2RlXG4gICAqIEByZXR1cm4ge09iamVjdH0gUmVwbGFjZW1lbnQgbm9kZVxuICAgKi9cbiAgcmVwbGFjZSAobm9kZSkge1xuICAgIGlmIChub2RlID09PSB0aGlzKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5mb3JFYWNoKChjaGlsZE5vZGUsIGkpID0+IHtcbiAgICAgIGlmIChjaGlsZE5vZGUgPT09IHRoaXMpIHtcbiAgICAgICAgbm9kZS5yb290Tm9kZSA9IHRoaXMucm9vdE5vZGVcbiAgICAgICAgbm9kZS5wYXJlbnROb2RlID0gdGhpcy5wYXJlbnROb2RlXG4gICAgICAgIG5vZGUuX25vZGVJZCA9IHRoaXMuX25vZGVJZFxuXG4gICAgICAgIHRoaXMucm9vdE5vZGUgPSB0aGlzXG4gICAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuXG4gICAgICAgIG5vZGUucGFyZW50Tm9kZS5fY2hpbGROb2Rlc1tpXSA9IG5vZGVcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIG5vZGVcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGN1cnJlbnQgbm9kZSBmcm9tIHRoZSBtaW1lIHRyZWVcbiAgICpcbiAgICogQHJldHVybiB7T2JqZWN0fSByZW1vdmVkIG5vZGVcbiAgICovXG4gIHJlbW92ZSAoKSB7XG4gICAgaWYgKCF0aGlzLnBhcmVudE5vZGUpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMucGFyZW50Tm9kZS5fY2hpbGROb2Rlc1tpXSA9PT0gdGhpcykge1xuICAgICAgICB0aGlzLnBhcmVudE5vZGUuX2NoaWxkTm9kZXMuc3BsaWNlKGksIDEpXG4gICAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuICAgICAgICB0aGlzLnJvb3ROb2RlID0gdGhpc1xuICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIGEgaGVhZGVyIHZhbHVlLiBJZiB0aGUgdmFsdWUgZm9yIHNlbGVjdGVkIGtleSBleGlzdHMsIGl0IGlzIG92ZXJ3cml0dGVuLlxuICAgKiBZb3UgY2FuIHNldCBtdWx0aXBsZSB2YWx1ZXMgYXMgd2VsbCBieSB1c2luZyBbe2tleTonJywgdmFsdWU6Jyd9XSBvclxuICAgKiB7a2V5OiAndmFsdWUnfSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0ga2V5IEhlYWRlciBrZXkgb3IgYSBsaXN0IG9mIGtleSB2YWx1ZSBwYWlyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBzZXRIZWFkZXIgKGtleSwgdmFsdWUpIHtcbiAgICBsZXQgYWRkZWQgPSBmYWxzZVxuXG4gICAgLy8gQWxsb3cgc2V0dGluZyBtdWx0aXBsZSBoZWFkZXJzIGF0IG9uY2VcbiAgICBpZiAoIXZhbHVlICYmIGtleSAmJiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGtleS5rZXkgJiYga2V5LnZhbHVlKSB7XG4gICAgICAgIC8vIGFsbG93IHtrZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XG4gICAgICAgIHRoaXMuc2V0SGVhZGVyKGtleS5rZXksIGtleS52YWx1ZSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpKSB7XG4gICAgICAgIC8vIGFsbG93IFt7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfV1cbiAgICAgICAga2V5LmZvckVhY2goaSA9PiB0aGlzLnNldEhlYWRlcihpLmtleSwgaS52YWx1ZSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbGxvdyB7J2NvbnRlbnQtdHlwZSc6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgT2JqZWN0LmtleXMoa2V5KS5mb3JFYWNoKGkgPT4gdGhpcy5zZXRIZWFkZXIoaSwga2V5W2ldKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAga2V5ID0gbm9ybWFsaXplSGVhZGVyS2V5KGtleSlcblxuICAgIGNvbnN0IGhlYWRlclZhbHVlID0geyBrZXksIHZhbHVlIH1cblxuICAgIC8vIENoZWNrIGlmIHRoZSB2YWx1ZSBleGlzdHMgYW5kIG92ZXJ3cml0ZVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLl9oZWFkZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5faGVhZGVyc1tpXS5rZXkgPT09IGtleSkge1xuICAgICAgICBpZiAoIWFkZGVkKSB7XG4gICAgICAgICAgLy8gcmVwbGFjZSB0aGUgZmlyc3QgbWF0Y2hcbiAgICAgICAgICB0aGlzLl9oZWFkZXJzW2ldID0gaGVhZGVyVmFsdWVcbiAgICAgICAgICBhZGRlZCA9IHRydWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyByZW1vdmUgZm9sbG93aW5nIG1hdGNoZXNcbiAgICAgICAgICB0aGlzLl9oZWFkZXJzLnNwbGljZShpLCAxKVxuICAgICAgICAgIGktLVxuICAgICAgICAgIGxlbi0tXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYXRjaCBub3QgZm91bmQsIGFwcGVuZCB0aGUgdmFsdWVcbiAgICBpZiAoIWFkZGVkKSB7XG4gICAgICB0aGlzLl9oZWFkZXJzLnB1c2goaGVhZGVyVmFsdWUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgaGVhZGVyIHZhbHVlLiBJZiB0aGUgdmFsdWUgZm9yIHNlbGVjdGVkIGtleSBleGlzdHMsIHRoZSB2YWx1ZSBpcyBhcHBlbmRlZFxuICAgKiBhcyBhIG5ldyBmaWVsZCBhbmQgb2xkIG9uZSBpcyBub3QgdG91Y2hlZC5cbiAgICogWW91IGNhbiBzZXQgbXVsdGlwbGUgdmFsdWVzIGFzIHdlbGwgYnkgdXNpbmcgW3trZXk6JycsIHZhbHVlOicnfV0gb3JcbiAgICoge2tleTogJ3ZhbHVlJ30gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGtleSBIZWFkZXIga2V5IG9yIGEgbGlzdCBvZiBrZXkgdmFsdWUgcGFpcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciB2YWx1ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IGN1cnJlbnQgbm9kZVxuICAgKi9cbiAgYWRkSGVhZGVyIChrZXksIHZhbHVlKSB7XG4gICAgLy8gQWxsb3cgc2V0dGluZyBtdWx0aXBsZSBoZWFkZXJzIGF0IG9uY2VcbiAgICBpZiAoIXZhbHVlICYmIGtleSAmJiB0eXBlb2Yga2V5ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGtleS5rZXkgJiYga2V5LnZhbHVlKSB7XG4gICAgICAgIC8vIGFsbG93IHtrZXk6J2NvbnRlbnQtdHlwZScsIHZhbHVlOiAndGV4dC9wbGFpbid9XG4gICAgICAgIHRoaXMuYWRkSGVhZGVyKGtleS5rZXksIGtleS52YWx1ZSlcbiAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShrZXkpKSB7XG4gICAgICAgIC8vIGFsbG93IFt7a2V5Oidjb250ZW50LXR5cGUnLCB2YWx1ZTogJ3RleHQvcGxhaW4nfV1cbiAgICAgICAga2V5LmZvckVhY2goaSA9PiB0aGlzLmFkZEhlYWRlcihpLmtleSwgaS52YWx1ZSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbGxvdyB7J2NvbnRlbnQtdHlwZSc6ICd0ZXh0L3BsYWluJ31cbiAgICAgICAgT2JqZWN0LmtleXMoa2V5KS5mb3JFYWNoKGkgPT4gdGhpcy5hZGRIZWFkZXIoaSwga2V5W2ldKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgdGhpcy5faGVhZGVycy5wdXNoKHsga2V5OiBub3JtYWxpemVIZWFkZXJLZXkoa2V5KSwgdmFsdWUgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBmaXJzdCBtYXRoY2luZyB2YWx1ZSBvZiBhIHNlbGVjdGVkIGtleVxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSB0byBzZWFyY2ggZm9yXG4gICAqIEByZXR1biB7U3RyaW5nfSBWYWx1ZSBmb3IgdGhlIGtleVxuICAgKi9cbiAgZ2V0SGVhZGVyIChrZXkpIHtcbiAgICBrZXkgPSBub3JtYWxpemVIZWFkZXJLZXkoa2V5KVxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9oZWFkZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5faGVhZGVyc1tpXS5rZXkgPT09IGtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVhZGVyc1tpXS52YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIGJvZHkgY29udGVudCBmb3IgY3VycmVudCBub2RlLiBJZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmcsIGNoYXJzZXQgaXMgYWRkZWQgYXV0b21hdGljYWxseVxuICAgKiB0byBDb250ZW50LVR5cGUgKGlmIGl0IGlzIHRleHQvKikuIElmIHRoZSB2YWx1ZSBpcyBhIFR5cGVkIEFycmF5LCB5b3UgbmVlZCB0byBzcGVjaWZ5XG4gICAqIHRoZSBjaGFyc2V0IHlvdXJzZWxmXG4gICAqXG4gICAqIEBwYXJhbSAoU3RyaW5nfFVpbnQ4QXJyYXkpIGNvbnRlbnQgQm9keSBjb250ZW50XG4gICAqIEByZXR1cm4ge09iamVjdH0gY3VycmVudCBub2RlXG4gICAqL1xuICBzZXRDb250ZW50IChjb250ZW50KSB7XG4gICAgdGhpcy5jb250ZW50ID0gY29udGVudFxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQnVpbGRzIHRoZSByZmMyODIyIG1lc3NhZ2UgZnJvbSB0aGUgY3VycmVudCBub2RlLiBJZiB0aGlzIGlzIGEgcm9vdCBub2RlLFxuICAgKiBtYW5kYXRvcnkgaGVhZGVyIGZpZWxkcyBhcmUgc2V0IGlmIG1pc3NpbmcgKERhdGUsIE1lc3NhZ2UtSWQsIE1JTUUtVmVyc2lvbilcbiAgICpcbiAgICogQHJldHVybiB7U3RyaW5nfSBDb21waWxlZCBtZXNzYWdlXG4gICAqL1xuICBidWlsZCAoKSB7XG4gICAgY29uc3QgbGluZXMgPSBbXVxuICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gKHRoaXMuZ2V0SGVhZGVyKCdDb250ZW50LVR5cGUnKSB8fCAnJykudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLnRyaW0oKVxuICAgIGxldCB0cmFuc2ZlckVuY29kaW5nXG4gICAgbGV0IGZsb3dlZFxuXG4gICAgaWYgKHRoaXMuY29udGVudCkge1xuICAgICAgdHJhbnNmZXJFbmNvZGluZyA9ICh0aGlzLmdldEhlYWRlcignQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZycpIHx8ICcnKS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkudHJpbSgpXG4gICAgICBpZiAoIXRyYW5zZmVyRW5jb2RpbmcgfHwgWydiYXNlNjQnLCAncXVvdGVkLXByaW50YWJsZSddLmluZGV4T2YodHJhbnNmZXJFbmNvZGluZykgPCAwKSB7XG4gICAgICAgIGlmICgvXnRleHRcXC8vaS50ZXN0KGNvbnRlbnRUeXBlKSkge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBubyBzcGVjaWFsIHN5bWJvbHMsIG5vIG5lZWQgdG8gbW9kaWZ5IHRoZSB0ZXh0XG4gICAgICAgICAgaWYgKGlzUGxhaW5UZXh0KHRoaXMuY29udGVudCkpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGFyZSBsaW5lcyBsb25nZXIgdGhhbiA3NiBzeW1ib2xzL2J5dGVzLCBtYWtlIHRoZSB0ZXh0ICdmbG93ZWQnXG4gICAgICAgICAgICBpZiAoL14uezc3LH0vbS50ZXN0KHRoaXMuY29udGVudCkpIHtcbiAgICAgICAgICAgICAgZmxvd2VkID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhbnNmZXJFbmNvZGluZyA9ICc3Yml0J1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2ZlckVuY29kaW5nID0gJ3F1b3RlZC1wcmludGFibGUnXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCEvXm11bHRpcGFydFxcLy9pLnRlc3QoY29udGVudFR5cGUpKSB7XG4gICAgICAgICAgdHJhbnNmZXJFbmNvZGluZyA9IHRyYW5zZmVyRW5jb2RpbmcgfHwgJ2Jhc2U2NCdcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodHJhbnNmZXJFbmNvZGluZykge1xuICAgICAgICB0aGlzLnNldEhlYWRlcignQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZycsIHRyYW5zZmVyRW5jb2RpbmcpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmlsZW5hbWUgJiYgIXRoaXMuZ2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJykpIHtcbiAgICAgIHRoaXMuc2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJywgJ2F0dGFjaG1lbnQnKVxuICAgIH1cblxuICAgIHRoaXMuX2hlYWRlcnMuZm9yRWFjaChoZWFkZXIgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gaGVhZGVyLmtleVxuICAgICAgbGV0IHZhbHVlID0gaGVhZGVyLnZhbHVlXG4gICAgICBsZXQgc3RydWN0dXJlZFxuXG4gICAgICBzd2l0Y2ggKGhlYWRlci5rZXkpIHtcbiAgICAgICAgY2FzZSAnQ29udGVudC1EaXNwb3NpdGlvbic6XG4gICAgICAgICAgc3RydWN0dXJlZCA9IHBhcnNlSGVhZGVyVmFsdWUodmFsdWUpXG4gICAgICAgICAgaWYgKHRoaXMuZmlsZW5hbWUgLyogY29uc2lkZXI6ICYmIHN0cnVjdHVyZWQudmFsdWUgPT09ICdhdHRhY2htZW50JyAqLykge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuZmlsZW5hbWUgPSB0aGlzLmZpbGVuYW1lXG4gICAgICAgICAgfVxuICAgICAgICAgIHZhbHVlID0gYnVpbGRIZWFkZXJWYWx1ZShzdHJ1Y3R1cmVkKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0NvbnRlbnQtVHlwZSc6XG4gICAgICAgICAgc3RydWN0dXJlZCA9IHBhcnNlSGVhZGVyVmFsdWUodmFsdWUpXG5cbiAgICAgICAgICB0aGlzLl9hZGRCb3VuZGFyeShzdHJ1Y3R1cmVkKVxuXG4gICAgICAgICAgaWYgKGZsb3dlZCkge1xuICAgICAgICAgICAgc3RydWN0dXJlZC5wYXJhbXMuZm9ybWF0ID0gJ2Zsb3dlZCdcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFN0cmluZyhzdHJ1Y3R1cmVkLnBhcmFtcy5mb3JtYXQpLnRvTG93ZXJDYXNlKCkudHJpbSgpID09PSAnZmxvd2VkJykge1xuICAgICAgICAgICAgZmxvd2VkID0gdHJ1ZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdHJ1Y3R1cmVkLnZhbHVlLm1hdGNoKC9edGV4dFxcLy8pICYmIHR5cGVvZiB0aGlzLmNvbnRlbnQgPT09ICdzdHJpbmcnICYmIC9bXFx1MDA4MC1cXHVGRkZGXS8udGVzdCh0aGlzLmNvbnRlbnQpKSB7XG4gICAgICAgICAgICBzdHJ1Y3R1cmVkLnBhcmFtcy5jaGFyc2V0ID0gJ3V0Zi04J1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhbHVlID0gYnVpbGRIZWFkZXJWYWx1ZShzdHJ1Y3R1cmVkKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0JjYyc6XG4gICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZUJjY0luSGVhZGVyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgLy8gc2tpcCBCQ0MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNraXAgZW1wdHkgbGluZXNcbiAgICAgIHZhbHVlID0gZW5jb2RlSGVhZGVyVmFsdWUoa2V5LCB2YWx1ZSlcbiAgICAgIGlmICghKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnRyaW0oKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbGluZXMucHVzaChmb2xkTGluZXMoa2V5ICsgJzogJyArIHZhbHVlKSlcbiAgICB9KVxuXG4gICAgLy8gRW5zdXJlIG1hbmRhdG9yeSBoZWFkZXIgZmllbGRzXG4gICAgaWYgKHRoaXMucm9vdE5vZGUgPT09IHRoaXMpIHtcbiAgICAgIGlmICghdGhpcy5nZXRIZWFkZXIoJ0RhdGUnKSkge1xuICAgICAgICBsaW5lcy5wdXNoKCdEYXRlOiAnICsgdGhpcy5kYXRlLnRvVVRDU3RyaW5nKCkucmVwbGFjZSgvR01ULywgJyswMDAwJykpXG4gICAgICB9XG4gICAgICAvLyBZb3UgcmVhbGx5IHNob3VsZCBkZWZpbmUgeW91ciBvd24gTWVzc2FnZS1JZCBmaWVsZFxuICAgICAgaWYgKCF0aGlzLmdldEhlYWRlcignTWVzc2FnZS1JZCcpKSB7XG4gICAgICAgIGxpbmVzLnB1c2goJ01lc3NhZ2UtSWQ6IDwnICtcbiAgICAgICAgICAvLyBjcnV4IHRvIGdlbmVyYXRlIHJhbmRvbSBzdHJpbmdzIGxpa2UgdGhpczpcbiAgICAgICAgICAvLyBcIjE0MDEzOTE5MDU1OTAtNThhYThjMzItZDMyYTA2NWMtYzFhMmFhZDJcIlxuICAgICAgICAgIFswLCAwLCAwXS5yZWR1Y2UoZnVuY3Rpb24gKHByZXYpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmV2ICsgJy0nICsgTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMDAwMDApXG4gICAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICAgICAgICAgICAgLnN1YnN0cmluZygxKVxuICAgICAgICAgIH0sIERhdGUubm93KCkpICtcbiAgICAgICAgICAnQCcgK1xuICAgICAgICAgIC8vIHRyeSB0byB1c2UgdGhlIGRvbWFpbiBvZiB0aGUgRlJPTSBhZGRyZXNzIG9yIGZhbGxiYWNrIGxvY2FsaG9zdFxuICAgICAgICAgICh0aGlzLmdldEVudmVsb3BlKCkuZnJvbSB8fCAnbG9jYWxob3N0Jykuc3BsaXQoJ0AnKS5wb3AoKSArXG4gICAgICAgICAgJz4nKVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLmdldEhlYWRlcignTUlNRS1WZXJzaW9uJykpIHtcbiAgICAgICAgbGluZXMucHVzaCgnTUlNRS1WZXJzaW9uOiAxLjAnKVxuICAgICAgfVxuICAgIH1cbiAgICBsaW5lcy5wdXNoKCcnKVxuXG4gICAgaWYgKHRoaXMuY29udGVudCkge1xuICAgICAgaWYgKHRoaXMuc2tpcENvbnRlbnRFbmNvZGluZykge1xuICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN3aXRjaCAodHJhbnNmZXJFbmNvZGluZykge1xuICAgICAgICAgIGNhc2UgJ3F1b3RlZC1wcmludGFibGUnOlxuICAgICAgICAgICAgbGluZXMucHVzaChxdW90ZWRQcmludGFibGVFbmNvZGUodGhpcy5jb250ZW50KSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgICAgIGxpbmVzLnB1c2goYmFzZTY0RW5jb2RlKHRoaXMuY29udGVudCwgdHlwZW9mIHRoaXMuY29udGVudCA9PT0gJ29iamVjdCcgPyAnYmluYXJ5JyA6IHVuZGVmaW5lZCkpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBpZiAoZmxvd2VkKSB7XG4gICAgICAgICAgICAgIC8vIHNwYWNlIHN0dWZmaW5nIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM2NzYjc2VjdGlvbi00LjJcbiAgICAgICAgICAgICAgbGluZXMucHVzaChmb2xkTGluZXModGhpcy5jb250ZW50LnJlcGxhY2UoL1xccj9cXG4vZywgJ1xcclxcbicpLnJlcGxhY2UoL14oIHxGcm9tfD4pL2lnbSwgJyAkMScpLCA3NiwgdHJ1ZSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lcy5wdXNoKHRoaXMuY29udGVudC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHJcXG4nKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVsdGlwYXJ0KSB7XG4gICAgICAgIGxpbmVzLnB1c2goJycpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubXVsdGlwYXJ0KSB7XG4gICAgICB0aGlzLl9jaGlsZE5vZGVzLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICAgIGxpbmVzLnB1c2goJy0tJyArIHRoaXMuYm91bmRhcnkpXG4gICAgICAgIGxpbmVzLnB1c2gobm9kZS5idWlsZCgpKVxuICAgICAgfSlcbiAgICAgIGxpbmVzLnB1c2goJy0tJyArIHRoaXMuYm91bmRhcnkgKyAnLS0nKVxuICAgICAgbGluZXMucHVzaCgnJylcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxyXFxuJylcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYW5kIHJldHVybnMgU01UUCBlbnZlbG9wZSB3aXRoIHRoZSBzZW5kZXIgYWRkcmVzcyBhbmQgYSBsaXN0IG9mIHJlY2lwaWVudHMgYWRkcmVzc2VzXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH0gU01UUCBlbnZlbG9wZSBpbiB0aGUgZm9ybSBvZiB7ZnJvbTogJ2Zyb21AZXhhbXBsZS5jb20nLCB0bzogWyd0b0BleGFtcGxlLmNvbSddfVxuICAgKi9cbiAgZ2V0RW52ZWxvcGUgKCkge1xuICAgIHZhciBlbnZlbG9wZSA9IHtcbiAgICAgIGZyb206IGZhbHNlLFxuICAgICAgdG86IFtdXG4gICAgfVxuICAgIHRoaXMuX2hlYWRlcnMuZm9yRWFjaChoZWFkZXIgPT4ge1xuICAgICAgdmFyIGxpc3QgPSBbXVxuICAgICAgaWYgKGhlYWRlci5rZXkgPT09ICdGcm9tJyB8fCAoIWVudmVsb3BlLmZyb20gJiYgWydSZXBseS1UbycsICdTZW5kZXInXS5pbmRleE9mKGhlYWRlci5rZXkpID49IDApKSB7XG4gICAgICAgIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXMoaGVhZGVyLnZhbHVlKSwgbGlzdClcbiAgICAgICAgaWYgKGxpc3QubGVuZ3RoICYmIGxpc3RbMF0pIHtcbiAgICAgICAgICBlbnZlbG9wZS5mcm9tID0gbGlzdFswXVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKFsnVG8nLCAnQ2MnLCAnQmNjJ10uaW5kZXhPZihoZWFkZXIua2V5KSA+PSAwKSB7XG4gICAgICAgIGNvbnZlcnRBZGRyZXNzZXMocGFyc2VBZGRyZXNzZXMoaGVhZGVyLnZhbHVlKSwgZW52ZWxvcGUudG8pXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBlbnZlbG9wZVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgY29udGVudCB0eXBlIGlzIG11bHRpcGFydCBhbmQgZGVmaW5lcyBib3VuZGFyeSBpZiBuZWVkZWQuXG4gICAqIERvZXNuJ3QgcmV0dXJuIGFueXRoaW5nLCBtb2RpZmllcyBvYmplY3QgYXJndW1lbnQgaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IHN0cnVjdHVyZWQgUGFyc2VkIGhlYWRlciB2YWx1ZSBmb3IgJ0NvbnRlbnQtVHlwZScga2V5XG4gICAqL1xuICBfYWRkQm91bmRhcnkgKHN0cnVjdHVyZWQpIHtcbiAgICB0aGlzLmNvbnRlbnRUeXBlID0gc3RydWN0dXJlZC52YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuXG4gICAgdGhpcy5tdWx0aXBhcnQgPSB0aGlzLmNvbnRlbnRUeXBlLnNwbGl0KCcvJykucmVkdWNlKGZ1bmN0aW9uIChwcmV2LCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIHByZXYgPT09ICdtdWx0aXBhcnQnID8gdmFsdWUgOiBmYWxzZVxuICAgIH0pXG5cbiAgICBpZiAodGhpcy5tdWx0aXBhcnQpIHtcbiAgICAgIHRoaXMuYm91bmRhcnkgPSBzdHJ1Y3R1cmVkLnBhcmFtcy5ib3VuZGFyeSA9IHN0cnVjdHVyZWQucGFyYW1zLmJvdW5kYXJ5IHx8IHRoaXMuYm91bmRhcnkgfHwgZ2VuZXJhdGVCb3VuZGFyeSh0aGlzLl9ub2RlSWQsIHRoaXMucm9vdE5vZGUuYmFzZUJvdW5kYXJ5KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJvdW5kYXJ5ID0gZmFsc2VcbiAgICB9XG4gIH1cbn1cbiJdfQ==