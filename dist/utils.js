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
exports.generateBoundary = generateBoundary;
exports.escapeHeaderArgument = escapeHeaderArgument;
exports.buildHeaderValue = buildHeaderValue;

var _ramda = require('ramda');

var _emailjsAddressparser = require('emailjs-addressparser');

var _emailjsAddressparser2 = _interopRequireDefault(_emailjsAddressparser);

var _emailjsMimeCodec = require('emailjs-mime-codec');

var _punycode = require('punycode');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// export const boundaryTag = '----sinikael-?=_'
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyJdLCJuYW1lcyI6WyJpc1BsYWluVGV4dCIsImNvbnZlcnRBZGRyZXNzZXMiLCJwYXJzZUFkZHJlc3NlcyIsImVuY29kZUhlYWRlclZhbHVlIiwibm9ybWFsaXplSGVhZGVyS2V5IiwiZ2VuZXJhdGVCb3VuZGFyeSIsImVzY2FwZUhlYWRlckFyZ3VtZW50IiwiYnVpbGRIZWFkZXJWYWx1ZSIsImJvdW5kYXJ5VGFnIiwiZW5jb2RlQWRkcmVzc05hbWUiLCJuYW1lIiwidGVzdCIsInJlcGxhY2UiLCJ2YWx1ZSIsImFkZHJlc3NlcyIsInVuaXF1ZUxpc3QiLCJ2YWx1ZXMiLCJjb25jYXQiLCJmb3JFYWNoIiwiYWRkcmVzcyIsInVzZXIiLCJkb21haW4iLCJzdWJzdHIiLCJwdXNoIiwiaW5kZXhPZiIsImdyb3VwIiwibGVuZ3RoIiwidHJpbSIsImpvaW4iLCJtYXAiLCJrZXkiLCJjaGFyQXQiLCJhcHBseSIsImVsbSIsInN0ciIsInNwbGl0IiwidG9TdHJpbmciLCJ0b0xvd2VyQ2FzZSIsImMiLCJ0b1VwcGVyQ2FzZSIsIm5vZGVJZCIsImJhc2VCb3VuZGFyeSIsIm1hdGNoIiwic3RydWN0dXJlZCIsInBhcmFtc0FycmF5IiwiT2JqZWN0Iiwia2V5cyIsInBhcmFtcyIsInBhcmFtIiwiZW5jb2RlZFBhcmFtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7UUFzQ2dCQSxXLEdBQUFBLFc7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFpQ0FDLGMsR0FBQUEsYztRQWVBQyxpQixHQUFBQSxpQjtRQXVEQUMsa0IsR0FBQUEsa0I7UUFXQUMsZ0IsR0FBQUEsZ0I7UUFXQUMsb0IsR0FBQUEsb0I7UUFjQUMsZ0IsR0FBQUEsZ0I7O0FBekxoQjs7QUFDQTs7OztBQUNBOztBQUtBOzs7O0FBRUE7QUFaQTtBQUNBOztBQVlPLElBQU1DLG9DQUFjLG1CQUFwQjs7QUFFUDs7Ozs7O0FBTUEsU0FBU0MsaUJBQVQsQ0FBNEJDLElBQTVCLEVBQWtDO0FBQ2hDLE1BQUksQ0FB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WCxJQUFxQixFQUFqQyxFQUFxQzdCLE9BQXJDLENBQTZDLGlCQUFTO0FBQ3BEO0FBQ0EsUUFBSThCLFVBQVUsVUFBZCxFQUEwQjtBQUN4QixnREFBbUJBLEtBQW5CLEVBQTBCTCxXQUFXSSxNQUFYLENBQWtCQyxLQUFsQixDQUExQixFQUFvRCxFQUFwRCxFQUF3RDlCLE9BQXhELENBQWdFLFVBQVUrQixZQUFWLEVBQXdCO0FBQ3RGO0FBQ0E7QUFDQUwsb0JBQVlyQixJQUFaLENBQWlCMEIsYUFBYW5CLEdBQWIsR0FBbUIsR0FBbkIsR0FBeUJtQixhQUFhcEMsS0FBdkQ7QUFDRCxPQUpEO0FBS0QsS0FORCxNQU1PO0FBQ0wrQixrQkFBWXJCLElBQVosQ0FBaUJ5QixRQUFRLEdBQVIsR0FBYzFDLHFCQUFxQnFDLFdBQVdJLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXJCLENBQS9CO0FBQ0Q7QUFDRixHQVhEOztBQWFBLFNBQU9MLFdBQVc5QixLQUFYLElBQW9CK0IsWUFBWWxCLE1BQVosR0FBcUIsT0FBT2tCLFlBQVloQixJQUFaLENBQWlCLElBQWpCLENBQTVCLEdBQXFELEVBQXpFLENBQVA7QUFDRCIsImZpbGUiOiJ1dGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlIG5vZGUvbm8tZGVwcmVjYXRlZC1hcGkgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnRyb2wtcmVnZXggKi9cblxuaW1wb3J0IHsgZmxhdHRlbiB9IGZyb20gJ3JhbWRhJ1xuaW1wb3J0IHBhcnNlQWRkcmVzcyBmcm9tICdlbWFpbGpzLWFkZHJlc3NwYXJzZXInXG5pbXBvcnQge1xuICBtaW1lV29yZHNFbmNvZGUsXG4gIG1pbWVXb3JkRW5jb2RlLFxuICBjb250aW51YXRpb25FbmNvZGVcbn0gZnJvbSAnZW1haWxqcy1taW1lLWNvZGVjJ1xuaW1wb3J0IHsgdG9BU0NJSSB9IGZyb20gJ3B1bnljb2RlJ1xuXG4vLyBleHBvcnQgY29uc3QgYm91bmRhcnlUYWcgPSAnLS0tLXNpbmlrYWVsLT89XydcbmV4cG9ydCBjb25zdCBib3VuZGFyeVRhZyA9ICctLS0tZ3JvdXB2aW5lX3YyLSdcblxuLyoqXG4gKiBJZiBuZWVkZWQsIG1pbWUgZW5jb2RlcyB0aGUgbmFtZSBwYXJ0XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBwYXJ0IG9mIGFuIGFkZHJlc3NcbiAqIEByZXR1cm5zIHtTdHJpbmd9IE1pbWUgd29yZCBlbmNvZGVkIHN0cmluZyBpZiBuZWVkZWRcbiAqL1xuZnVuY3Rpb24gZW5jb2RlQWRkcmVzc05hbWUgKG5hbWUpIHtcbiAgaWYgKCEvXltcXHcgJ10qJC8udGVzdChuYW1lKSkge1xuICAgIGlmICgvXltcXHgyMC1cXHg3ZV0qJC8udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuICdcIicgKyBuYW1lLnJlcGxhY2UoLyhbXFxcXFwiXSkvZywgJ1xcXFwkMScpICsgJ1wiJ1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbWltZVdvcmRFbmNvZGUobmFtZSwgJ1EnKVxuICAgIH1cbiAgfVxuICByZXR1cm4gbmFtZVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIHZhbHVlIGlzIHBsYWludGV4dCBzdHJpbmcgKHVzZXMgb25seSBwcmludGFibGUgN2JpdCBjaGFycylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgU3RyaW5nIHRvIGJlIHRlc3RlZFxuICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgaXQgaXMgYSBwbGFpbnRleHQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1BsYWluVGV4dCAodmFsdWUpIHtcbiAgcmV0dXJuICEodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJyB8fCAvW1xceDAwLVxceDA4XFx4MGJcXHgwY1xceDBlLVxceDFmXFx1MDA4MC1cXHVGRkZGXS8udGVzdCh2YWx1ZSkpXG59XG5cbi8qKlxuICogUmVidWlsZHMgYWRkcmVzcyBvYmplY3QgdXNpbmcgcHVueWNvZGUgYW5kIG90aGVyIGFkanVzdG1lbnRzXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYWRkcmVzc2VzIEFuIGFycmF5IG9mIGFkZHJlc3Mgb2JqZWN0c1xuICogQHBhcmFtIHtBcnJheX0gW3VuaXF1ZUxpc3RdIEFuIGFycmF5IHRvIGJlIHBvcHVsYXRlZCB3aXRoIGFkZHJlc3Nlc1xuICogQHJldHVybiB7U3RyaW5nfSBhZGRyZXNzIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydEFkZHJlc3NlcyAoYWRkcmVzc2VzID0gW10sIHVuaXF1ZUxpc3QgPSBbXSkge1xuICB2YXIgdmFsdWVzID0gW11cblxuICA7W10uY29uY2F0KGFkZHJlc3NlcykuZm9yRWFjaChhZGRyZXNzID0+IHtcbiAgICBpZiAoYWRkcmVzcy5hZGRyZXNzKSB7XG4gICAgICBhZGRyZXNzLmFkZHJlc3MgPSBhZGRyZXNzLmFkZHJlc3NcbiAgICAgICAgLnJlcGxhY2UoL14uKj8oPz1AKS8sIHVzZXIgPT4gbWltZVdvcmRzRW5jb2RlKHVzZXIsICdRJykpXG4gICAgICAgIC5yZXBsYWNlKC9ALiskLywgZG9tYWluID0+ICdAJyArIHRvQVNDSUkoZG9tYWluLnN1YnN0cigxKSkpXG5cbiAgICAgIGlmICghYWRkcmVzcy5uYW1lKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKGFkZHJlc3MuYWRkcmVzcylcbiAgICAgIH0gZWxzZSBpZiAoYWRkcmVzcy5uYW1lKSB7XG4gICAgICAgIHZhbHVlcy5wdXNoKGVuY29kZUFkZHJlc3NOYW1lKGFkZHJlc3MubmFtZSkgKyAnIDwnICsgYWRkcmVzcy5hZGRyZXNzICsgJz4nKVxuICAgICAgfVxuXG4gICAgICBpZiAodW5pcXVlTGlzdC5pbmRleE9mKGFkZHJlc3MuYWRkcmVzcykgPCAwKSB7XG4gICAgICAgIHVuaXF1ZUxpc3QucHVzaChhZGRyZXNzLmFkZHJlc3MpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhZGRyZXNzLmdyb3VwKSB7XG4gICAgICB2YWx1ZXMucHVzaChlbmNvZGVBZGRyZXNzTmFtZShhZGRyZXNzLm5hbWUpICsgJzonICsgKGFkZHJlc3MuZ3JvdXAubGVuZ3RoID8gY29udmVydEFkZHJlc3NlcyhhZGRyZXNzLmdyb3VwLCB1bmlxdWVMaXN0KSA6ICcnKS50cmltKCkgKyAnOycpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiB2YWx1ZXMuam9pbignLCAnKVxufVxuXG4vKipcbiAqIFBhcnNlcyBhZGRyZXNzZXMuIFRha2VzIGluIGEgc2luZ2xlIGFkZHJlc3Mgb3IgYW4gYXJyYXkgb3IgYW5cbiAqIGFycmF5IG9mIGFkZHJlc3MgYXJyYXlzIChlZy4gVG86IFtbZmlyc3QgZ3JvdXBdLCBbc2Vjb25kIGdyb3VwXSwuLi5dKVxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFkZHJlc3NlcyBBZGRyZXNzZXMgdG8gYmUgcGFyc2VkXG4gKiBAcmV0dXJuIHtBcnJheX0gQW4gYXJyYXkgb2YgYWRkcmVzcyBvYmplY3RzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFkZHJlc3NlcyAoYWRkcmVzc2VzID0gW10pIHtcbiAgcmV0dXJuIGZsYXR0ZW4oW10uY29uY2F0KGFkZHJlc3NlcykubWFwKChhZGRyZXNzKSA9PiB7XG4gICAgaWYgKGFkZHJlc3MgJiYgYWRkcmVzcy5hZGRyZXNzKSB7XG4gICAgICBhZGRyZXNzID0gY29udmVydEFkZHJlc3NlcyhhZGRyZXNzKVxuICAgIH1cbiAgICByZXR1cm4gcGFyc2VBZGRyZXNzKGFkZHJlc3MpXG4gIH0pKVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBoZWFkZXIgdmFsdWUgZm9yIHVzZSBpbiB0aGUgZ2VuZXJhdGVkIHJmYzI4MjIgZW1haWwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBIZWFkZXIga2V5XG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgSGVhZGVyIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVIZWFkZXJWYWx1ZSAoa2V5LCB2YWx1ZSA9ICcnKSB7XG4gIGtleSA9IG5vcm1hbGl6ZUhlYWRlcktleShrZXkpXG5cbiAgc3dpdGNoIChrZXkpIHtcbiAgICBjYXNlICdGcm9tJzpcbiAgICBjYXNlICdTZW5kZXInOlxuICAgIGNhc2UgJ1RvJzpcbiAgICBjYXNlICdDYyc6XG4gICAgY2FzZSAnQmNjJzpcbiAgICBjYXNlICdSZXBseS1Ubyc6XG4gICAgICByZXR1cm4gY29udmVydEFkZHJlc3NlcyhwYXJzZUFkZHJlc3Nlcyh2YWx1ZSkpXG5cbiAgICBjYXNlICdNZXNzYWdlLUlkJzpcbiAgICBjYXNlICdJbi1SZXBseS1Ubyc6XG4gICAgY2FzZSAnQ29udGVudC1JZCc6XG4gICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcblxuICAgICAgaWYgKHZhbHVlLmNoYXJBdCgwKSAhPT0gJzwnKSB7XG4gICAgICAgIHZhbHVlID0gJzwnICsgdmFsdWVcbiAgICAgIH1cblxuICAgICAgaWYgKHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKSAhPT0gJz4nKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUgKyAnPidcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZVxuXG4gICAgY2FzZSAnUmVmZXJlbmNlcyc6XG4gICAgICB2YWx1ZSA9IFtdLmNvbmNhdC5hcHBseShbXSwgW10uY29uY2F0KHZhbHVlKS5tYXAoKGVsbSA9ICcnKSA9PiBlbG1cbiAgICAgICAgLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJylcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAucmVwbGFjZSgvPFtePl0qPi9nLCBzdHIgPT4gc3RyLnJlcGxhY2UoL1xccy9nLCAnJykpXG4gICAgICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgICApKS5tYXAoZnVuY3Rpb24gKGVsbSkge1xuICAgICAgICBpZiAoZWxtLmNoYXJBdCgwKSAhPT0gJzwnKSB7XG4gICAgICAgICAgZWxtID0gJzwnICsgZWxtXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVsbS5jaGFyQXQoZWxtLmxlbmd0aCAtIDEpICE9PSAnPicpIHtcbiAgICAgICAgICBlbG0gPSBlbG0gKyAnPidcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZWxtXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gdmFsdWUuam9pbignICcpLnRyaW0oKVxuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBtaW1lV29yZHNFbmNvZGUoKHZhbHVlIHx8ICcnKS50b1N0cmluZygpLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICcgJyksICdCJylcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZXMgYSBoZWFkZXIga2V5LCB1c2VzIENhbWVsLUNhc2UgZm9ybSwgZXhjZXB0IGZvciB1cHBlcmNhc2UgTUlNRS1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSB0byBiZSBub3JtYWxpemVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGtleSBpbiBDYW1lbC1DYXNlIGZvcm1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlcktleSAoa2V5ID0gJycpIHtcbiAgcmV0dXJuIGtleS5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnICcpIC8vIG5vIG5ld2xpbmVzIGluIGtleXNcbiAgICAudHJpbSgpLnRvTG93ZXJDYXNlKClcbiAgICAucmVwbGFjZSgvXk1JTUVcXGJ8XlthLXpdfC1bYS16XS9pZywgYyA9PiBjLnRvVXBwZXJDYXNlKCkpIC8vIHVzZSB1cHBlcmNhc2Ugd29yZHMsIGV4Y2VwdCBNSU1FXG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgbXVsdGlwYXJ0IGJvdW5kYXJ5IHZhbHVlXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSBib3VuZGFyeSB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVCb3VuZGFyeSAobm9kZUlkLCBiYXNlQm91bmRhcnkpIHtcbiAgcmV0dXJuIGJvdW5kYXJ5VGFnICsgbm9kZUlkICsgJy0nICsgYmFzZUJvdW5kYXJ5XG59XG5cbi8qKlxuICogRXNjYXBlcyBhIGhlYWRlciBhcmd1bWVudCB2YWx1ZSAoZWcuIGJvdW5kYXJ5IHZhbHVlIGZvciBjb250ZW50IHR5cGUpLFxuICogYWRkcyBzdXJyb3VuZGluZyBxdW90ZXMgaWYgbmVlZGVkXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIEhlYWRlciBhcmd1bWVudCB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBlc2NhcGVkIGFuZCBxdW90ZWQgKGlmIG5lZWRlZCkgYXJndW1lbnQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUhlYWRlckFyZ3VtZW50ICh2YWx1ZSkge1xuICBpZiAodmFsdWUubWF0Y2goL1tcXHMnXCJcXFxcOy89XXxeLS9nKSkge1xuICAgIHJldHVybiAnXCInICsgdmFsdWUucmVwbGFjZSgvKFtcIlxcXFxdKS9nLCAnXFxcXCQxJykgKyAnXCInXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cbn1cblxuLyoqXG4gKiBKb2lucyBwYXJzZWQgaGVhZGVyIHZhbHVlIHRvZ2V0aGVyIGFzICd2YWx1ZTsgcGFyYW0xPXZhbHVlMTsgcGFyYW0yPXZhbHVlMidcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gc3RydWN0dXJlZCBQYXJzZWQgaGVhZGVyIHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGpvaW5lZCBoZWFkZXIgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkSGVhZGVyVmFsdWUgKHN0cnVjdHVyZWQpIHtcbiAgdmFyIHBhcmFtc0FycmF5ID0gW11cblxuICBPYmplY3Qua2V5cyhzdHJ1Y3R1cmVkLnBhcmFtcyB8fCB7fSkuZm9yRWFjaChwYXJhbSA9PiB7XG4gICAgLy8gZmlsZW5hbWUgbWlnaHQgaW5jbHVkZSB1bmljb2RlIGNoYXJhY3RlcnMgc28gaXQgaXMgYSBzcGVjaWFsIGNhc2VcbiAgICBpZiAocGFyYW0gPT09ICdmaWxlbmFtZScpIHtcbiAgICAgIGNvbnRpbnVhdGlvbkVuY29kZShwYXJhbSwgc3RydWN0dXJlZC5wYXJhbXNbcGFyYW1dLCA1MCkuZm9yRWFjaChmdW5jdGlvbiAoZW5jb2RlZFBhcmFtKSB7XG4gICAgICAgIC8vIGNvbnRpbnVhdGlvbiBlbmNvZGVkIHN0cmluZ3MgYXJlIGFsd2F5cyBlc2NhcGVkLCBzbyBubyBuZWVkIHRvIHVzZSBlbmNsb3NpbmcgcXVvdGVzXG4gICAgICAgIC8vIGluIGZhY3QgdXNpbmcgcXVvdGVzIG1pZ2h0IGVuZCB1cCB3aXRoIGludmFsaWQgZmlsZW5hbWVzIGluIHNvbWUgY2xpZW50c1xuICAgICAgICBwYXJhbXNBcnJheS5wdXNoKGVuY29kZWRQYXJhbS5rZXkgKyAnPScgKyBlbmNvZGVkUGFyYW0udmFsdWUpXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXNBcnJheS5wdXNoKHBhcmFtICsgJz0nICsgZXNjYXBlSGVhZGVyQXJndW1lbnQoc3RydWN0dXJlZC5wYXJhbXNbcGFyYW1dKSlcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHN0cnVjdHVyZWQudmFsdWUgKyAocGFyYW1zQXJyYXkubGVuZ3RoID8gJzsgJyArIHBhcmFtc0FycmF5LmpvaW4oJzsgJykgOiAnJylcbn1cbiJdfQ==