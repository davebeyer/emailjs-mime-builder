'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.boundaryTag = undefined;
exports.isPlainText = isPlainText;
exports.convertAddresses = convertAddresses;
exports.parseAddresses = parseAddresses;
exports.encodeHeaderValue = encodeHeaderValue;
exports.normalizeHeaderKey = normalizeHeaderKey;
exports.escapeHeaderArgument = escapeHeaderArgument;
exports.buildHeaderValue = buildHeaderValue;

var _ramda = require('ramda');

var _emailjsAddressparser = require('emailjs-addressparser');

var _emailjsAddressparser2 = _interopRequireDefault(_emailjsAddressparser);

var _emailjsMimeCodec = require('emailjs-mime-codec');

var _punycode = require('punycode');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// export const boundaryTag = '----sinikael-?=_';
/* eslint-disable node/no-deprecated-api */
/* eslint-disable no-control-regex */

var boundaryTag = exports.boundaryTag = '----groupvine_v2-';

/**
 * If needed, mime encodes the name part
 *
 * @param {String} name Name part of an address
 * @returns {String} Mime word encoded string if needed
 */
function encodeAddressName(name) {
  if (!/^[\w ']*$/.test(name)) {
    if (/^[\x20-\x7e]*$/.test(name)) {
      return '"' + name.replace(/([\\"])/g, '\\$1') + '"';
    } else {
      return (0, _emailjsMimeCodec.mimeWordEncode)(name, 'Q');
    }
  }
  return name;
}

/**
 * Checks if a value is plaintext string (uses only printable 7bit chars)
 *
 * @param {String} value String to be tested
 * @returns {Boolean} true if it is a plaintext string
 */
function isPlainText(value) {
  return !(typeof value !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(value));
}

/**
 * Rebuilds address object using punycode and other adjustments
 *
 * @param {Array} addresses An array of address objects
 * @param {Array} [uniqueList] An array to be populated with addresses
 * @return {String} address string
 */
function convertAddresses() {
  var addresses = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var uniqueList = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  var values = [];[].concat(addresses).forEach(function (address) {
    if (address.address) {
      address.address = address.address.replace(/^.*?(?=@)/, function (user) {
        return (0, _emailjsMimeCodec.mimeWordsEncode)(user, 'Q');
      }).replace(/@.+$/, function (domain) {
        return '@' + (0, _punycode.toASCII)(domain.substr(1));
      });

      if (!address.name) {
        values.push(address.address);
      } else if (address.name) {
        values.push(encodeAddressName(address.name) + ' <' + address.address + '>');
      }

      if (uniqueList.indexOf(address.address) < 0) {
        uniqueList.push(address.address);
      }
    } else if (address.group) {
      values.push(encodeAddressName(address.name) + ':' + (address.group.length ? convertAddresses(address.group, uniqueList) : '').trim() + ';');
    }
  });

  return values.join(', ');
}

/**
 * Parses addresses. Takes in a single address or an array or an
 * array of address arrays (eg. To: [[first group], [second group],...])
 *
 * @param {Mixed} addresses Addresses to be parsed
 * @return {Array} An array of address objects
 */
function parseAddresses() {
  var addresses = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return (0, _ramda.flatten)([].concat(addresses).map(function (address) {
    if (address && address.address) {
      address = convertAddresses(address);
    }
    return (0, _emailjsAddressparser2.default)(address);
  }));
}

/**
 * Encodes a header value for use in the generated rfc2822 email.
 *
 * @param {String} key Header key
 * @param {String} value Header value
 */
function encodeHeaderValue(key) {
  var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

  key = normalizeHeaderKey(key);

  switch (key) {
    case 'From':
    case 'Sender':
    case 'To':
    case 'Cc':
    case 'Bcc':
    case 'Reply-To':
      return convertAddresses(parseAddresses(value));

    case 'Message-Id':
    case 'In-Reply-To':
    case 'Content-Id':
      value = value.replace(/\r?\n|\r/g, ' ');

      if (value.charAt(0) !== '<') {
        value = '<' + value;
      }

      if (value.charAt(value.length - 1) !== '>') {
        value = value + '>';
      }
      return value;

    case 'References':
      value = [].concat.apply([], [].concat(value).map(function () {
        var elm = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        return elm.replace(/\r?\n|\r/g, ' ').trim().replace(/<[^>]*>/g, function (str) {
          return str.replace(/\s/g, '');
        }).split(/\s+/);
      })).map(function (elm) {
        if (elm.charAt(0) !== '<') {
          elm = '<' + elm;
        }
        if (elm.charAt(elm.length - 1) !== '>') {
          elm = elm + '>';
        }
        return elm;
      });

      return value.join(' ').trim();

    default:
      return (0, _emailjsMimeCodec.mimeWordsEncode)((value || '').toString().replace(/\r?\n|\r/g, ' '), 'B');
  }
}

/**
 * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
 *
 * @param {String} key Key to be normalized
 * @return {String} key in Camel-Case form
 */
function normalizeHeaderKey() {
  var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

  return key.replace(/\r?\n|\r/g, ' ') // no newlines in keys
  .trim().toLowerCase().replace(/^MIME\b|^[a-z]|-[a-z]/ig, function (c) {
    return c.toUpperCase();
  }); // use uppercase words, except MIME
}

/**
 * Generates a multipart boundary value
 *
 * @return {String} boundary value
 */
function generateBoundary(nodeId, baseBoundary) {
  return boundaryTag + nodeId + '-' + baseBoundary;
}

/**
 * Escapes a header argument value (eg. boundary value for content type),
 * adds surrounding quotes if needed
 *
 * @param {String} value Header argument value
 * @return {String} escaped and quoted (if needed) argument value
 */
function escapeHeaderArgument(value) {
  if (value.match(/[\s'"\\;/=]|^-/g)) {
    return '"' + value.replace(/(["\\])/g, '\\$1') + '"';
  } else {
    return value;
  }
}

/**
 * Joins parsed header value together as 'value; param1=value1; param2=value2'
 *
 * @param {Object} structured Parsed header value
 * @return {String} joined header value
 */
function buildHeaderValue(structured) {
  var paramsArray = [];

  Object.keys(structured.params || {}).forEach(function (param) {
    // filename might include unicode characters so it is a special case
    if (param === 'filename') {
      (0, _emailjsMimeCodec.continuationEncode)(param, structured.params[param], 50).forEach(function (encodedParam) {
        // continuation encoded strings are always escaped, so no need to use enclosing quotes
        // in fact using quotes might end up with invalid filenames in some clients
        paramsArray.push(encodedParam.key + '=' + encodedParam.value);
      });
    } else {
      paramsArray.push(param + '=' + escapeHeaderArgument(structured.params[param]));
    }
  });

  return structured.value + (paramsArray.length ? '; ' + paramsArray.join('; ') : '');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6WyJpc1BsYWluVGV4dCIsImNvbnZlcnRBZGRyZXNzZXMiLCJwYXJzZUFkZHJlc3NlcyIsImVuY29kZUhlYWRlclZhbHVlIiwibm9ybWFsaXplSGVhZGVyS2V5IiwiZXNjYXBlSGVhZGVyQXJndW1lbnQiLCJidWlsZEhlYWRlclZhbHVlIiwiYm91bmRhcnlUYWciLCJlbmNvZGVBZGRyZXNzTmFtZSIsIm5hbWUiLCJ0ZXN0IiwicmVwbGFjZSIsInZhbHVlIiwiYWRkcmVzc2VzIiwidW5pcXVlTGlzdCIsInZhbHVlcyIsImNvbmNhdCIsImZvckVhY2giLCJhZGRyZXNzIiwidXNlciIsImRvbWFpbiIsInN1YnN0ciIsInB1c2giLCJpbmRleE9mIiwiZ3JvdXAiLCJsZW5ndGgiLCJ0cmltIiwiam9pbiIsIm1hcCIsImtleSIsImNoYXJBdCIsImFwcGx5IiwiZWxtIiwic3RyIiwic3BsaXQiLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiYyIsInRvVXBwZXJDYXNlIiwiZ2VuZXJhdGVCb3VuZGFyeSIsIm5vZGVJZCIsImJhc2VCb3VuZGFyeSIsIm1hdGNoIiwic3RydWN0dXJlZCIsInBhcmFtc0FycmF5IiwiT2JqZWN0Iiwia2V5cyIsInBhcmFtcyIsInBhcmFtIiwiZW5jb2RlZFBhcmFtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7UUFzQ2dCQSxXLEdBQUFBLFc7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFpQ0FDLGMsR0FBQUEsYztRQWVBQyxpQixHQUFBQSxpQjtRQXVEQUMsa0IsR0FBQUEsa0I7UUFzQkFDLG9CLEdBQUFBLG9CO1FBY0FDLGdCLEdBQUFBLGdCOztBQXpMaEI7O0FBQ0E7Ozs7QUFDQTs7QUFLQTs7OztBQUVBO0FBWkE7QUFDQTs7QUFZTyxJQUFNQyxvQ0FBYyxtQkFBcEI7O0FBRVA7Ozs7OztBQU1BLFNBQVNDLGlCQUFULENBQTRCQyxJQUE1QixFQUFrQztBQUNoQyxNQUFJLENBQUMsWUFBWUMsSUFBWixDQUFp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QixPQUFyQyxDQUE2QyxpQkFBUztBQUNwRDtBQUNBLFFBQUkrQixVQUFVLFVBQWQsRUFBMEI7QUFDeEIsZ0RBQW1CQSxLQUFuQixFQUEwQkwsV0FBV0ksTUFBWCxDQUFrQkMsS0FBbEIsQ0FBMUIsRUFBb0QsRUFBcEQsRUFBd0QvQixPQUF4RCxDQUFnRSxVQUFVZ0MsWUFBVixFQUF3QjtBQUN0RjtBQUNBO0FBQ0FMLG9CQUFZdEIsSUFBWixDQUFpQjJCLGFBQWFwQixHQUFiLEdBQW1CLEdBQW5CLEdBQXlCb0IsYUFBYXJDLEtBQXZEO0FBQ0QsT0FKRDtBQUtELEtBTkQsTUFNTztBQUNMZ0Msa0JBQVl0QixJQUFaLENBQWlCMEIsUUFBUSxHQUFSLEdBQWMzQyxxQkFBcUJzQyxXQUFXSSxNQUFYLENBQWtCQyxLQUFsQixDQUFyQixDQUEvQjtBQUNEO0FBQ0YsR0FYRDs7QUFhQSxTQUFPTCxXQUFXL0IsS0FBWCxJQUFvQmdDLFlBQVluQixNQUFaLEdBQXFCLE9BQU9tQixZQUFZakIsSUFBWixDQUFpQixJQUFqQixDQUE1QixHQUFxRCxFQUF6RSxDQUFQO0FBQ0QiLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBub2RlL25vLWRlcHJlY2F0ZWQtYXBpICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb250cm9sLXJlZ2V4ICovXG5cbmltcG9ydCB7IGZsYXR0ZW4gfSBmcm9tICdyYW1kYSdcbmltcG9ydCBwYXJzZUFkZHJlc3MgZnJvbSAnZW1haWxqcy1hZGRyZXNzcGFyc2VyJ1xuaW1wb3J0IHtcbiAgbWltZVdvcmRzRW5jb2RlLFxuICBtaW1lV29yZEVuY29kZSxcbiAgY29udGludWF0aW9uRW5jb2RlXG59IGZyb20gJ2VtYWlsanMtbWltZS1jb2RlYydcbmltcG9ydCB7IHRvQVNDSUkgfSBmcm9tICdwdW55Y29kZSdcblxuLy8gZXhwb3J0IGNvbnN0IGJvdW5kYXJ5VGFnID0gJy0tLS1zaW5pa2FlbC0/PV8nO1xuZXhwb3J0IGNvbnN0IGJvdW5kYXJ5VGFnID0gJy0tLS1ncm91cHZpbmVfdjItJztcblxuLyoqXG4gKiBJZiBuZWVkZWQsIG1pbWUgZW5jb2RlcyB0aGUgbmFtZSBwYXJ0XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBwYXJ0IG9mIGFuIGFkZHJlc3NcbiAqIEByZXR1cm5zIHtTdHJpbmd9IE1pbWUgd29yZCBlbmNvZGVkIHN0cmluZyBpZiBuZWVkZWRcbiAqL1xuZnVuY3Rpb24gZW5jb2RlQWRkcmVzc05hbWUgKG5hbWUpIHtcbiAgaWYgKCEvXltcXHcgJ10qJC8udGVzdChuYW1lKSkge1xuICAgIGlmICgvXltcXHgyMC1cXHg3ZV0qJC8udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuICdcIicgKyBuYW1lLnJlcGxhY2UoLyhbXFxcXFwiXSkvZywgJ1xcXFwkMScpICsgJ1wiJ1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbWltZVdvcmRFbmNvZGUobmFtZSwgJ1EnKVxuICAgIH1cbiAgfVxuICByZXR1cm4gbmFtZVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIHZhbHVlIGlzIHBsYWludGV4dCBzdHJpbmcgKHVzZXMgb25seSBwcmludGFibGUgN2JpdCBjaGFycylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgU3RyaW5nIHRvIGJlIHRlc3RlZFxuICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgaXQgaXMgYSBwbGFpbnRleHQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1BsYWluVGV4dCAodmFsdWUpIHtcbiAgcmV0dXJuICEodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJyB8fCAvW1xceDAwLVxceDA4XFx4MGJcXHgwY1xceDBlLVxceDFmXFx1MDA4MC1cXHVGRkZGXS8udGVzdCh2YWx1ZSkpXG59XG5cbi8qKlxuICogUmVidWlsZHMgYWRkcmVzcyBvYmplY3QgdXNpbmcgcHVueWNvZGUgYW5kIG90aGVyIGFkanVzdG1lbnRzXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYWRkcmVzc2VzIEFuIGFycmF5IG9mIGFkZHJlc3Mgb2JqZWN0c1xuICogQHBhcmFtIHtBcnJheX0gW3VuaXF1ZUxpc3RdIEFuIGFycmF5IHRvIGJlIHBvcHVsYXRlZCB3aXRoIGFkZHJlc3Nlc1xuICogQHJldHVybiB7U3RyaW5nfSBhZGRyZXNzIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEFkZHJlc3NlcyAoYWRkcmVzc2VzID0gW10sIHVuaXF1ZUxpc3QgPSBbXSkge1xuICB2YXIgdmFsdWVzID0gW11cblxuICA7W10uY29uY2F0KGFkZHJlc3NlcykuZm9yRWFjaChhZGRyZXNzID0+IHtcbiAgICBpZiAoYWRkcmVzcy5hZGRyZXNzKSB7XG4gICAgICBhZGRyZXNzLmFkZHJlc3MgPSBhZGRyZXNzLmFkZHJlc3NcbiAgICAgICAgLnJlcGxhY2UoL14uKj8oPz1AKS8sIHVzZXIgPT4gbWltZVdvcmRzRW5jb2RlKHVzZXIsICdRJykpXG4gICAgICAgIC5yZXBsYWNlKC9ALiskLywgZG9tYWluID0+ICdAJyArIHRvQVNDSUkoZG9tYWluLnN1YnN0cigxKSkpXG5cbiAgICAgIGlmICghYWRkcmVzcy5uYW1lKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKGFkZHJlc3MuYWRkcmVzcylcbiAgICAgIH0gZWxzZSBpZiAoYWRkcmVzcy5uYW1lKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKGVuY29kZUFkZHJlc3NOYW1lKGFkZHJlc3MubmFtZSkgKyAnIDwnICsgYWRkcmVzcy5hZGRyZXNzICsgJz4nKVxuICAgICAgfVxuXG4gICAgICBpZiAodW5pcXVlTGlzdC5pbmRleE9mKGFkZHJlc3MuYWRkcmVzcykgPCAwKSB7XG4gICAgICAgIHVuaXF1ZUxpc3QucHVzaChhZGRyZXNzLmFkZHJlc3MpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhZGRyZXNzLmdyb3VwKSB7XG4gICAgICB2YWx1ZXMucHVzaChlbmNvZGVBZGRyZXNzTmFtZShhZGRyZXNzLm5hbWUpICsgJzonICsgKGFkZHJlc3MuZ3JvdXAubGVuZ3RoID8gY29udmVydEFkZHJlc3NlcyhhZGRyZXNzLmdyb3VwLCB1bmlxdWVMaXN0KSA6ICcnKS50cmltKCkgKyAnOycpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiB2YWx1ZXMuam9pbignLCAnKVxufVxuXG4vKipcbiAqIFBhcnNlcyBhZGRyZXNzZXMuIFRha2VzIGluIGEgc2luZ2xlIGFkZHJlc3Mgb3IgYW4gYXJyYXkgb3IgYW5cbiAqIGFycmF5IG9mIGFkZHJlc3MgYXJyYXlzIChlZy4gVG86IFtbZmlyc3QgZ3JvdXBdLCBbc2Vjb25kIGdyb3VwXSwuLi5dKVxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFkZHJlc3NlcyBBZGRyZXNzZXMgdG8gYmUgcGFyc2VkXG4gKiBAcmV0dXJuIHtBcnJheX0gQW4gYXJyYXkgb2YgYWRkcmVzcyBvYmplY3RzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFkZHJlc3NlcyAoYWRkcmVzc2VzID0gW10pIHtcbiAgcmV0dXJuIGZsYXR0ZW4oW10uY29uY2F0KGFkZHJlc3NlcykubWFwKChhZGRyZXNzKSA9PiB7XG4gICAgaWYgKGFkZHJlc3MgJiYgYWRkcmVzcy5hZGRyZXNzKSB7XG4gICAgICBhZGRyZXNzID0gY29udmVydEFkZHJlc3NlcyhhZGRyZXNzKVxuICAgIH1cbiAgICByZXR1cm4gcGFyc2VBZGRyZXNzKGFkZHJlc3MpXG4gIH0pKVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBoZWFkZXIgdmFsdWUgZm9yIHVzZSBpbiB0aGUgZ2VuZXJhdGVkIHJmYzI4MjIgZW1haWwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBIZWFkZXIga2V5XG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVIZWFkZXJWYWx1ZSAoa2V5LCB2YWx1ZSA9ICcnKSB7XG4gIGtleSA9IG5vcm1hbGl6ZUhlYWRlcktleShrZXkpXG5cbiAgc3dpdGNoIChrZXkpIHtcbiAgICBjYXNlICdGcm9tJzpcbiAgICBjYXNlICdTZW5kZXInOlxuICAgIGNhc2UgJ1RvJzpcbiAgICBjYXNlICdDYyc6XG4gICAgY2FzZSAnQmNjJzpcbiAgICBjYXNlICdSZXBseS1Ubyc6XG4gICAgICByZXR1cm4gY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3Nlcyh2YWx1ZSkpXG5cbiAgICBjYXNlICdNZXNzYWdlLUlkJzpcbiAgICBjYXNlICdJbi1SZXBseS1Ubyc6XG4gICAgY2FzZSAnQ29udGVudC1JZCc6XG4gICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcblxuICAgICAgaWYgKHZhbHVlLmNoYXJBdCgwKSAhPT0gJzwnKSB7XG4gICAgICAgIHZhbHVlID0gJzwnICsgdmFsdWVcbiAgICAgIH1cblxuICAgICAgaWYgKHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKSAhPT0gJz4nKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUgKyAnPidcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZVxuXG4gICAgY2FzZSAnUmVmZXJlbmNlcyc6XG4gICAgICB2YWx1ZSA9IFtdLmNvbmNhdC5hcHBseShbXSwgW10uY29uY2F0KHZhbHVlKS5tYXAoKGVsbSA9ICcnKSA9PiBlbG1cbiAgICAgICAgLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAucmVwbGFjZSgvPFtePl0qPi9nLCBzdHIgPT4gc3RyLnJlcGxhY2UoL1xccy9nLCAnJykpXG4gICAgICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgICApKS5tYXAoZnVuY3Rpb24gKGVsbSkge1xuICAgICAgICBpZiAoZWxtLmNoYXJBdCgwKSAhPT0gJzwnKSB7XG4gICAgICAgICAgZWxtID0gJzwnICsgZWxtXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVsbS5jaGFyQXQoZWxtLmxlbmd0aCAtIDEpICE9PSAnPicpIHtcbiAgICAgICAgICBlbG0gPSBlbG0gKyAnPidcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZWxtXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gdmFsdWUuam9pbignICcpLnRyaW0oKVxuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBtaW1lV29yZHNFbmNvZGUoKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJyksICdCJylcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBoZWFkZXIga2V5LCB1c2VzIENhbWVsLUNhc2UgZm9ybSwgZXhjZXB0IGZvciB1cHBlcmNhc2UgTUlNRS1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSB0byBiZSBub3JtYWxpemVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGtleSBpbiBDYW1lbC1DYXNlIGZvcm1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlcktleSAoa2V5ID0gJycpIHtcbiAgcmV0dXJuIGtleS5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnICcpIC8vIG5vIG5ld2xpbmVzIGluIGtleXNcbiAgICAudHJpbSgpLnRvTG93ZXJDYXNlKClcbiAgICAucmVwbGFjZSgvXk1JTUVcXGJ8XlthLXpdfC1bYS16XS9pZywgYyA9PiBjLnRvVXBwZXJDYXNlKCkpIC8vIHVzZSB1cHBlcmNhc2Ugd29yZHMsIGV4Y2VwdCBNSU1FXG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgbXVsdGlwYXJ0IGJvdW5kYXJ5IHZhbHVlXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSBib3VuZGFyeSB2YWx1ZVxuICovXG5mdW5jdGlvbiBnZW5lcmF0ZUJvdW5kYXJ5KG5vZGVJZCwgYmFzZUJvdW5kYXJ5KSB7XG4gIHJldHVybiAgYm91bmRhcnlUYWcgKyBub2RlSWQgKyAnLScgKyBiYXNlQm91bmRhcnlcbn1cblxuLyoqXG4gKiBFc2NhcGVzIGEgaGVhZGVyIGFyZ3VtZW50IHZhbHVlIChlZy4gYm91bmRhcnkgdmFsdWUgZm9yIGNvbnRlbnQgdHlwZSksXG4gKiBhZGRzIHN1cnJvdW5kaW5nIHF1b3RlcyBpZiBuZWVkZWRcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIGFyZ3VtZW50IHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGVzY2FwZWQgYW5kIHF1b3RlZCAoaWYgbmVlZGVkKSBhcmd1bWVudCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlSGVhZGVyQXJndW1lbnQgKHZhbHVlKSB7XG4gIGlmICh2YWx1ZS5tYXRjaCgvW1xccydcIlxcXFw7Lz1dfF4tL2cpKSB7XG4gICAgcmV0dXJuICdcIicgKyB2YWx1ZS5yZXBsYWNlKC8oW1wiXFxcXF0pL2csICdcXFxcJDEnKSArICdcIidcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmFsdWVcbiAgfVxufVxuXG4vKipcbiAqIEpvaW5zIHBhcnNlZCBoZWFkZXIgdmFsdWUgdG9nZXRoZXIgYXMgJ3ZhbHVlOyBwYXJhbTE9dmFsdWUxOyBwYXJhbTI9dmFsdWUyJ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBzdHJ1Y3R1cmVkIFBhcnNlZCBoZWFkZXIgdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ30gam9pbmVkIGhlYWRlciB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRIZWFkZXJWYWx1ZSAoc3RydWN0dXJlZCkge1xuICB2YXIgcGFyYW1zQXJyYXkgPSBbXVxuXG4gIE9iamVjdC5rZXlzKHN0cnVjdHVyZWQucGFyYW1zIHx8IHt9KS5mb3JFYWNoKHBhcmFtID0+IHtcbiAgICAvLyBmaWxlbmFtZSBtaWdodCBpbmNsdWRlIHVuaWNvZGUgY2hhcmFjdGVycyBzbyBpdCBpcyBhIHNwZWNpYWwgY2FzZVxuICAgIGlmIChwYXJhbSA9PT0gJ2ZpbGVuYW1lJykge1xuICAgICAgY29udGludWF0aW9uRW5jb2RlKHBhcmFtLCBzdHJ1Y3R1cmVkLnBhcmFtc1twYXJhbV0sIDUwKS5mb3JFYWNoKGZ1bmN0aW9uIChlbmNvZGVkUGFyYW0pIHtcbiAgICAgICAgLy8gY29udGludWF0aW9uIGVuY29kZWQgc3RyaW5ncyBhcmUgYWx3YXlzIGVzY2FwZWQsIHNvIG5vIG5lZWQgdG8gdXNlIGVuY2xvc2luZyBxdW90ZXNcbiAgICAgICAgLy8gaW4gZmFjdCB1c2luZyBxdW90ZXMgbWlnaHQgZW5kIHVwIHdpdGggaW52YWxpZCBmaWxlbmFtZXMgaW4gc29tZSBjbGllbnRzXG4gICAgICAgIHBhcmFtc0FycmF5LnB1c2goZW5jb2RlZFBhcmFtLmtleSArICc9JyArIGVuY29kZWRQYXJhbS52YWx1ZSlcbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtc0FycmF5LnB1c2gocGFyYW0gKyAnPScgKyBlc2NhcGVIZWFkZXJBcmd1bWVudChzdHJ1Y3R1cmVkLnBhcmFtc1twYXJhbV0pKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gc3RydWN0dXJlZC52YWx1ZSArIChwYXJhbXNBcnJheS5sZW5ndGggPyAnOyAnICsgcGFyYW1zQXJyYXkuam9pbignOyAnKSA6ICcnKVxufVxuIl19