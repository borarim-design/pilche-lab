/* fonteditor-core 2.6.3 — MIT; see fonteditor-core.LICENSE */
(function(){const modules={
"ttf/ttfwriter.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _writer = _interopRequireDefault(__load("ttf/writer.js"));
var _directory = _interopRequireDefault(__load("ttf/table/directory.js"));
var _support = _interopRequireDefault(__load("ttf/table/support.js"));
var _checkSum = _interopRequireDefault(__load("ttf/util/checkSum.js"));
var _error = _interopRequireDefault(__load("ttf/error.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); } /**
 * @file ttf写入器
 * @author mengke01(kekee000@gmail.com)
 */
// 支持写的表, 注意表顺序
var SUPPORT_TABLES = ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post'];
var TTFWriter = exports.default = /*#__PURE__*/function () {
  function TTFWriter() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _classCallCheck(this, TTFWriter);
    this.options = {
      writeZeroContoursGlyfData: options.writeZeroContoursGlyfData || false,
      // 不写入空 glyf 数据
      hinting: options.hinting || false,
      // 默认不保留hints信息
      kerning: options.kerning || false,
      // 默认不保留 kernings space 信息
      support: options.support // 自定义的导出表结构，可以自己修改某些表项目
    };
  }

  /**
   * 处理ttf结构，以便于写
   *
   * @param {ttfObject} ttf ttf数据结构
   */
  return _createClass(TTFWriter, [{
    key: "resolveTTF",
    value: function resolveTTF(ttf) {
      // 头部信息
      ttf.version = ttf.version || 0x1;
      ttf.numTables = ttf.writeOptions.tables.length;
      ttf.entrySelector = Math.floor(Math.log(ttf.numTables) / Math.LN2);
      ttf.searchRange = Math.pow(2, ttf.entrySelector) * 16;
      ttf.rangeShift = ttf.numTables * 16 - ttf.searchRange;

      // 重置校验码
      ttf.head.checkSumAdjustment = 0;
      ttf.head.magickNumber = 0x5F0F3CF5;
      if (typeof ttf.head.created === 'string') {
        ttf.head.created = /^\d+$/.test(ttf.head.created) ? +ttf.head.created : Date.parse(ttf.head.created);
      }
      if (typeof ttf.head.modified === 'string') {
        ttf.head.modified = /^\d+$/.test(ttf.head.modified) ? +ttf.head.modified : Date.parse(ttf.head.modified);
      }
      // 重置日期
      if (!ttf.head.created) {
        ttf.head.created = Date.now();
      }
      if (!ttf.head.modified) {
        ttf.head.modified = ttf.head.created;
      }
      var checkUnicodeRepeat = {}; // 检查是否有重复代码点

      // 将glyf的代码点按小到大排序
      ttf.glyf.forEach(function (glyf, index) {
        if (glyf.unicode) {
          glyf.unicode = glyf.unicode.sort();
          glyf.unicode.forEach(function (u) {
            if (checkUnicodeRepeat[u]) {
              _error.default.raise({
                number: 10200,
                data: index
              }, index);
            } else {
              checkUnicodeRepeat[u] = true;
            }
          });
        }
      });
    }

    /**
     * 写ttf文件
     *
     * @param {ttfObject} ttf ttf数据结构
     * @return {ArrayBuffer} 字节流
     */
  }, {
    key: "dump",
    value: function dump(ttf) {
      // 用来做写入缓存的对象，用完后删掉
      ttf.support = Object.assign({}, this.options.support);

      // head + directory
      var ttfSize = 12 + ttf.numTables * 16;
      var ttfHeadOffset = 0; // 记录head的偏移

      // 构造tables
      ttf.support.tables = [];
      ttf.writeOptions.tables.forEach(function (tableName) {
        var offset = ttfSize;
        var TableClass = _support.default[tableName];
        var tableSize = new TableClass().size(ttf); // 原始的表大小
        var size = tableSize; // 对齐后的表大小

        if (tableName === 'head') {
          ttfHeadOffset = offset;
        }

        // 4字节对齐
        if (size % 4) {
          size += 4 - size % 4;
        }
        ttf.support.tables.push({
          name: tableName,
          checkSum: 0,
          offset: offset,
          length: tableSize,
          size: size
        });
        ttfSize += size;
      });
      var writer = new _writer.default(new ArrayBuffer(ttfSize));

      // 写头部
      writer.writeFixed(ttf.version);
      writer.writeUint16(ttf.numTables);
      writer.writeUint16(ttf.searchRange);
      writer.writeUint16(ttf.entrySelector);
      writer.writeUint16(ttf.rangeShift);

      // 写表偏移
      new _directory.default().write(writer, ttf);

      // 写支持的表数据
      ttf.support.tables.forEach(function (table) {
        var tableStart = writer.offset;
        var TableClass = _support.default[table.name];
        new TableClass().write(writer, ttf);
        if (table.length % 4) {
          // 对齐字节
          writer.writeEmpty(4 - table.length % 4);
        }

        // 计算校验和
        table.checkSum = (0, _checkSum.default)(writer.getBuffer(), tableStart, table.size);
      });

      // 重新写入每个表校验和
      ttf.support.tables.forEach(function (table, index) {
        var offset = 12 + index * 16 + 4;
        writer.writeUint32(table.checkSum, offset);
      });

      // 写入总校验和
      var ttfCheckSum = (0xB1B0AFBA - (0, _checkSum.default)(writer.getBuffer()) + 0x100000000) % 0x100000000;
      writer.writeUint32(ttfCheckSum, ttfHeadOffset + 8);
      delete ttf.writeOptions;
      delete ttf.support;
      var buffer = writer.getBuffer();
      writer.dispose();
      return buffer;
    }

    /**
     * 对ttf的表进行评估，标记需要处理的表
     *
     * @param  {Object} ttf ttf对象
     */
  }, {
    key: "prepareDump",
    value: function prepareDump(ttf) {
      if (!ttf.glyf || ttf.glyf.length === 0) {
        _error.default.raise(10201);
      }
      if (!ttf['OS/2'] || !ttf.head || !ttf.name) {
        _error.default.raise(10204);
      }
      var tables = SUPPORT_TABLES.slice(0);
      ttf.writeOptions = {};
      // hinting tables direct copy
      if (this.options.hinting) {
        ['cvt', 'fpgm', 'prep', 'gasp', 'GPOS', 'kern', 'kerx'].forEach(function (table) {
          if (ttf[table]) {
            tables.push(table);
          }
        });
      }
      // copy kerning space table
      if (this.options.kerning) {
        ['GPOS', 'kern', 'kerx'].forEach(function (table) {
          if (ttf[table]) {
            tables.push(table);
          }
        });
      }
      ttf.writeOptions.writeZeroContoursGlyfData = !!this.options.writeZeroContoursGlyfData;
      ttf.writeOptions.hinting = !!this.options.hinting;
      ttf.writeOptions.kerning = !!this.options.kerning;
      ttf.writeOptions.tables = tables.sort();
    }

    /**
     * 写一个ttf字体结构
     *
     * @param {Object} ttf ttf数据结构
     * @return {ArrayBuffer} 缓冲数组
     */
  }, {
    key: "write",
    value: function write(ttf) {
      this.prepareDump(ttf);
      this.resolveTTF(ttf);
      var buffer = this.dump(ttf);
      return buffer;
    }

    /**
     * 注销
     */
  }, {
    key: "dispose",
    value: function dispose() {
      delete this.options;
    }
  }]);
}();
},
"ttf/writer.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _lang = __load("common/lang.js");
var _error = _interopRequireDefault(__load("ttf/error.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); } /**
 * @file 数据写入器
 * @author mengke01(kekee000@gmail.com)
 */
// 检查数组支持情况
if (typeof ArrayBuffer === 'undefined' || typeof DataView === 'undefined') {
  throw new Error('not support ArrayBuffer and DataView');
}

// 数据类型
var dataType = {
  Int8: 1,
  Int16: 2,
  Int32: 4,
  Uint8: 1,
  Uint16: 2,
  Uint32: 4,
  Float32: 4,
  Float64: 8
};

/**
 * 读取器
 *
 * @constructor
 * @param {Array.<byte>} buffer 缓冲数组
 * @param {number} offset 起始偏移
 * @param {number=} length 数组长度
 * @param {boolean=} littleEndian 是否小尾
 */
var Writer = /*#__PURE__*/function () {
  function Writer(buffer, offset, length, littleEndian) {
    _classCallCheck(this, Writer);
    var bufferLength = buffer.byteLength || buffer.length;
    this.offset = offset || 0;
    this.length = length || bufferLength - this.offset;
    this.littleEndian = littleEndian || false;
    this.view = new DataView(buffer, this.offset, this.length);
  }

  /**
   * 读取指定的数据类型
   *
   * @param {string} type 数据类型
   * @param {number} value value值
   * @param {number=} offset 位移
   * @param {boolean=} littleEndian 是否小尾
   *
   * @return {this}
   */
  return _createClass(Writer, [{
    key: "write",
    value: function write(type, value, offset, littleEndian) {
      // 使用当前位移
      if (undefined === offset) {
        offset = this.offset;
      }

      // 使用小尾
      if (undefined === littleEndian) {
        littleEndian = this.littleEndian;
      }

      // 扩展方法
      if (undefined === dataType[type]) {
        return this['write' + type](value, offset, littleEndian);
      }
      var size = dataType[type];
      this.offset = offset + size;
      this.view['set' + type](offset, value, littleEndian);
      return this;
    }

    /**
     * 写入指定的字节数组
     *
     * @param {ArrayBuffer} value 写入值
     * @param {number=} length 数组长度
     * @param {number=} offset 起始偏移
     * @return {this}
     */
  }, {
    key: "writeBytes",
    value: function writeBytes(value, length, offset) {
      length = length || value.byteLength || value.length;
      var i;
      if (!length) {
        return this;
      }
      if (undefined === offset) {
        offset = this.offset;
      }
      if (length < 0 || offset + length > this.length) {
        _error.default.raise(10002, this.length, offset + length);
      }
      var littleEndian = this.littleEndian;
      if (value instanceof ArrayBuffer) {
        var view = new DataView(value, 0, length);
        for (i = 0; i < length; ++i) {
          this.view.setUint8(offset + i, view.getUint8(i, littleEndian), littleEndian);
        }
      } else {
        for (i = 0; i < length; ++i) {
          this.view.setUint8(offset + i, value[i], littleEndian);
        }
      }
      this.offset = offset + length;
      return this;
    }

    /**
     * 写空数据
     *
     * @param {number} length 长度
     * @param {number=} offset 起始偏移
     * @return {this}
     */
  }, {
    key: "writeEmpty",
    value: function writeEmpty(length, offset) {
      if (length < 0) {
        _error.default.raise(10002, this.length, length);
      }
      if (undefined === offset) {
        offset = this.offset;
      }
      var littleEndian = this.littleEndian;
      for (var i = 0; i < length; ++i) {
        this.view.setUint8(offset + i, 0, littleEndian);
      }
      this.offset = offset + length;
      return this;
    }

    /**
     * 写入一个string
     *
     * @param {string} str 字符串
     * @param {number=} length 长度
     * @param {number=} offset 偏移
     *
     * @return {this}
     */
  }, {
    key: "writeString",
    value: function writeString() {
      var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      var length = arguments.length > 1 ? arguments[1] : undefined;
      var offset = arguments.length > 2 ? arguments[2] : undefined;
      if (undefined === offset) {
        offset = this.offset;
      }

      // eslint-disable-next-line no-control-regex
      length = length || str.replace(/[^\x00-\xff]/g, '11').length;
      if (length < 0 || offset + length > this.length) {
        _error.default.raise(10002, this.length, offset + length);
      }
      this.seek(offset);
      for (var i = 0, l = str.length, charCode; i < l; ++i) {
        charCode = str.charCodeAt(i) || 0;
        if (charCode > 127) {
          // unicode编码可能会超出2字节,
          // 写入与编码有关系，此处不做处理
          this.writeUint16(charCode);
        } else {
          this.writeUint8(charCode);
        }
      }
      this.offset = offset + length;
      return this;
    }

    /**
     * 写入一个字符
     *
     * @param {string} value 字符
     * @param {number=} offset 偏移
     * @return {this}
     */
  }, {
    key: "writeChar",
    value: function writeChar(value, offset) {
      return this.writeString(value, offset);
    }

    /**
     * 写入fixed类型
     *
     * @param {number} value 写入值
     * @param {number=} offset 偏移
     * @return {number} float
     */
  }, {
    key: "writeFixed",
    value: function writeFixed(value, offset) {
      if (undefined === offset) {
        offset = this.offset;
      }
      this.writeInt32(Math.round(value * 65536), offset);
      return this;
    }

    /**
     * 写入长日期
     *
     * @param {Date} value 日期对象
     * @param {number=} offset 偏移
     *
     * @return {Date} Date对象
     */
  }, {
    key: "writeLongDateTime",
    value: function writeLongDateTime(value, offset) {
      if (undefined === offset) {
        offset = this.offset;
      }

      // new Date(1970, 1, 1).getTime() - new Date(1904, 1, 1).getTime();
      var delta = -2077545600000;
      if (typeof value === 'undefined') {
        value = delta;
      } else if (typeof value.getTime === 'function') {
        value = value.getTime();
      } else if (/^\d+$/.test(value)) {
        value = +value;
      } else {
        value = Date.parse(value);
      }
      var time = Math.round((value - delta) / 1000);
      this.writeUint32(0, offset);
      this.writeUint32(time, offset + 4);
      return this;
    }

    /**
     * 跳转到指定偏移
     *
     * @param {number=} offset 偏移
     * @return {this}
     */
  }, {
    key: "seek",
    value: function seek(offset) {
      if (undefined === offset) {
        this.offset = 0;
      }
      if (offset < 0 || offset > this.length) {
        _error.default.raise(10002, this.length, offset);
      }
      this._offset = this.offset;
      this.offset = offset;
      return this;
    }

    /**
     * 跳转到写入头部位置
     *
     * @return {this}
     */
  }, {
    key: "head",
    value: function head() {
      this.offset = this._offset || 0;
      return this;
    }

    /**
     * 获取缓存的byte数组
     *
     * @return {ArrayBuffer}
     */
  }, {
    key: "getBuffer",
    value: function getBuffer() {
      return this.view.buffer;
    }

    /**
     * 注销
     */
  }, {
    key: "dispose",
    value: function dispose() {
      delete this.view;
    }
  }]);
}(); // 直接支持的数据类型
Object.keys(dataType).forEach(function (type) {
  Writer.prototype['write' + type] = (0, _lang.curry)(Writer.prototype.write, type);
});
var _default = exports.default = Writer;
},
"common/lang.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clone = clone;
exports.curry = curry;
exports.debounce = debounce;
exports.equals = equals;
exports.generic = generic;
exports.isArray = isArray;
exports.isDate = isDate;
exports.isEmptyObject = isEmptyObject;
exports.isFunction = isFunction;
exports.isObject = isObject;
exports.isString = isString;
exports.overwrite = overwrite;
exports.throttle = throttle;
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
/**
 * @file 语言相关函数
 * @author mengke01(kekee000@gmail.com)
 */

function isArray(obj) {
  return obj != null && toString.call(obj).slice(8, -1) === 'Array';
}
function isObject(obj) {
  return obj != null && toString.call(obj).slice(8, -1) === 'Object';
}
function isString(obj) {
  return obj != null && toString.call(obj).slice(8, -1) === 'String';
}
function isFunction(obj) {
  return obj != null && toString.call(obj).slice(8, -1) === 'Function';
}
function isDate(obj) {
  return obj != null && toString.call(obj).slice(8, -1) === 'Date';
}
function isEmptyObject(object) {
  for (var name in object) {
    // eslint-disable-next-line no-prototype-builtins
    if (object.hasOwnProperty(name)) {
      return false;
    }
  }
  return true;
}

/**
 * 为函数提前绑定前置参数（柯里化）
 *
 * @see http://en.wikipedia.org/wiki/Currying
 * @param {Function} fn 要绑定的函数
 * @param {...Array} cargs cargs
 * @return {Function}
 */
function curry(fn) {
  for (var _len = arguments.length, cargs = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    cargs[_key - 1] = arguments[_key];
  }
  return function () {
    for (var _len2 = arguments.length, rargs = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      rargs[_key2] = arguments[_key2];
    }
    var args = cargs.concat(rargs);
    // eslint-disable-next-line no-invalid-this
    return fn.apply(this, args);
  };
}

/**
 * 方法静态化, 反绑定、延迟绑定
 *
 * @param {Function} method 待静态化的方法
 * @return {Function} 静态化包装后方法
 */
function generic(method) {
  return function () {
    for (var _len3 = arguments.length, fargs = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      fargs[_key3] = arguments[_key3];
    }
    return Function.call.apply(method, fargs);
  };
}

/**
 * 设置覆盖相关的属性值
 *
 * @param {Object} thisObj 覆盖对象
 * @param {Object} thatObj 值对象
 * @param {Array.<string>} fields 字段
 * @return {Object} thisObj
 */
function overwrite(thisObj, thatObj, fields) {
  if (!thatObj) {
    return thisObj;
  }

  // 这里`fields`未指定则仅overwrite自身可枚举的字段，指定`fields`则不做限制
  fields = fields || Object.keys(thatObj);
  fields.forEach(function (field) {
    // 拷贝对象
    if (thisObj[field] && _typeof(thisObj[field]) === 'object' && thatObj[field] && _typeof(thatObj[field]) === 'object') {
      overwrite(thisObj[field], thatObj[field]);
    } else {
      thisObj[field] = thatObj[field];
    }
  });
  return thisObj;
}

/**
 * 深复制对象，仅复制数据
 *
 * @param {Object} source 源数据
 * @return {Object} 复制的数据
 */
function clone(source) {
  if (!source || _typeof(source) !== 'object') {
    return source;
  }
  var cloned = source;
  if (isArray(source)) {
    cloned = source.slice().map(clone);
  } else if (isObject(source) && 'isPrototypeOf' in source) {
    cloned = {};
    for (var _i = 0, _Object$keys = Object.keys(source); _i < _Object$keys.length; _i++) {
      var key = _Object$keys[_i];
      cloned[key] = clone(source[key]);
    }
  }
  return cloned;
}

// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time.
// @see underscore.js
function throttle(func, wait) {
  var context;
  var args;
  var timeout;
  var result;
  var previous = 0;
  var later = function later() {
    previous = new Date();
    timeout = null;
    result = func.apply(context, args);
  };
  return function () {
    var now = new Date();
    var remaining = wait - (now - previous);
    // eslint-disable-next-line no-invalid-this
    context = this;
    if (remaining <= 0) {
      clearTimeout(timeout);
      timeout = null;
      previous = now;
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      result = func.apply(context, args);
    } else if (!timeout) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
// @see underscore.js
function debounce(func, wait, immediate) {
  var timeout;
  var result;
  return function () {
    for (var _len5 = arguments.length, args = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
      args[_key5] = arguments[_key5];
    }
    // eslint-disable-next-line no-invalid-this
    var context = this;
    var later = function later() {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
    }
    return result;
  };
}

/**
 * 判断两个对象的字段是否相等
 *
 * @param  {Object} thisObj 要比较的对象
 * @param  {Object} thatObj 参考对象
 * @param  {Array} fields 指定字段
 * @return {boolean}  是否相等
 */
function equals(thisObj, thatObj, fields) {
  if (thisObj === thatObj) {
    return true;
  }
  if (thisObj == null && thatObj == null) {
    return true;
  }
  if (thisObj == null && thatObj != null || thisObj != null && thatObj == null) {
    return false;
  }

  // 这里`fields`未指定则仅overwrite自身可枚举的字段，指定`fields`则不做限制
  fields = fields || (_typeof(thisObj) === 'object' ? Object.keys(thisObj) : []);
  if (!fields.length) {
    return thisObj === thatObj;
  }
  var equal = true;
  for (var i = 0, l = fields.length, field; equal && i < l; i++) {
    field = fields[i];
    if (thisObj[field] && _typeof(thisObj[field]) === 'object' && thatObj[field] && _typeof(thatObj[field]) === 'object') {
      equal = equal && equals(thisObj[field], thatObj[field]);
    } else {
      equal = equal && thisObj[field] === thatObj[field];
    }
  }
  return equal;
}
},
"ttf/error.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _string = _interopRequireDefault(__load("common/string.js"));
var _i18n = _interopRequireDefault(__load("ttf/i18n.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); } /**
 * @file ttf 相关错误号定义
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = {
  /**
   * 抛出一个异常
   *
   * @param  {Object} e 异常号或者异常对象
   * @param  {...Array} fargs args 参数
   *
   * 例如：
   * e = 1001
   * e = {
   *     number: 1001,
   *     data: 错误数据
   * }
   */
  raise: function raise(e) {
    var number;
    var data;
    if (_typeof(e) === 'object') {
      number = e.number || 0;
      data = e.data;
    } else {
      number = e;
    }
    var message = _i18n.default.lang[number];
    for (var _len = arguments.length, fargs = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      fargs[_key - 1] = arguments[_key];
    }
    if (fargs.length > 0) {
      var args = _typeof(fargs[0]) === 'object' ? fargs[0] : fargs;
      message = _string.default.format(message, args);
    }
    var event = new Error(message);
    event.number = number;
    if (data) {
      event.data = data;
    }
    throw event;
  }
};
},
"common/string.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file 字符串相关的函数
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = {
  /**
   * HTML解码字符串
   *
   * @param {string} source 源字符串
   * @return {string}
   */
  decodeHTML: function decodeHTML(source) {
    var str = String(source).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    // 处理转义的中文和实体字符
    return str.replace(/&#([\d]+);/g, function ($0, $1) {
      return String.fromCodePoint(parseInt($1, 10));
    });
  },
  /**
   * HTML编码字符串
   *
   * @param {string} source 源字符串
   * @return {string}
   */
  encodeHTML: function encodeHTML(source) {
    return String(source).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  /**
   * 获取string字节长度
   *
   * @param {string} source 源字符串
   * @return {number} 长度
   */
  getLength: function getLength(source) {
    // eslint-disable-next-line no-control-regex
    return String(source).replace(/[^\x00-\xff]/g, '11').length;
  },
  /**
   * 字符串格式化，支持如 ${xxx.xxx} 的语法
   *
   * @param {string} source 模板字符串
   * @param {Object} data 数据
   * @return {string} 格式化后字符串
   */
  format: function format(source, data) {
    return source.replace(/\$\{([\w.]+)\}/g, function ($0, $1) {
      var ref = $1.split('.');
      var refObject = data;
      var level;
      while (refObject != null && (level = ref.shift())) {
        refObject = refObject[level];
      }
      return refObject != null ? refObject : '';
    });
  },
  /**
   * 使用指定字符填充字符串,默认`0`
   *
   * @param {string} str 字符串
   * @param {number} size 填充到的大小
   * @param {string=} ch 填充字符
   * @return {string} 字符串
   */
  pad: function pad(str, size, ch) {
    str = String(str);
    if (str.length > size) {
      return str.slice(str.length - size);
    }
    return new Array(size - str.length + 1).join(ch || '0') + str;
  },
  /**
   * 获取字符串哈希编码
   *
   * @param {string} str 字符串
   * @return {number} 哈希值
   */
  hashcode: function hashcode(str) {
    if (!str) {
      return 0;
    }
    var hash = 0;
    for (var i = 0, l = str.length; i < l; i++) {
      hash = 0x7FFFFFFFF & hash * 31 + str.charCodeAt(i);
    }
    return hash;
  }
};
},
"ttf/i18n.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _I18n = _interopRequireDefault(__load("common/I18n.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file 语言字符串管理
 * @author mengke01(kekee000@gmail.com)
 */

var zh = {
  // error define
  10001: '超出读取范围：${0}, ${1}',
  10002: '超出写入范围：${0}, ${1}',
  10003: '未知数据类型：${0}, ${1}',
  10004: '不支持svg解析',
  10101: '错误的ttf文件',
  10102: '错误的woff文件',
  10103: '错误的svg文件',
  10104: '读取ttf文件错误',
  10105: '读取woff文件错误',
  10106: '读取svg文件错误',
  10107: '写入ttf文件错误',
  10108: '写入woff文件错误',
  10109: '写入svg文件错误',
  10112: '写入svg symbol 错误',
  10110: '读取eot文件错误',
  10111: '读取eot字体错误',
  10200: '重复的unicode代码点，字形序号：${0}',
  10201: 'ttf字形轮廓数据为空',
  10202: '不支持标志位：ARGS_ARE_XY_VALUES',
  10203: '未找到表：${0}',
  10204: '读取ttf表错误',
  10205: '未找到解压函数',
  10301: '错误的otf文件',
  10302: '读取otf表错误',
  10303: 'otf字形轮廓数据为空'
};
var en = {
  // error define
  10001: 'Reading index out of range: ${0}, ${1}',
  10002: 'Writing index out of range: ${0}, ${1}',
  10003: 'Unknown datatype: ${0}, ${1}',
  10004: 'No svg parser',
  10101: 'ttf file damaged',
  10102: 'woff file damaged',
  10103: 'svg file damaged',
  10104: 'Read ttf error',
  10105: 'Read woff error',
  10106: 'Read svg error',
  10107: 'Write ttf error',
  10108: 'Write woff error',
  10109: 'Write svg error',
  10112: 'Write svg symbol error',
  10110: 'Read eot error',
  10111: 'Write eot error',
  10200: 'Repeat unicode, glyph index: ${0}',
  10201: 'ttf `glyph` data is empty',
  10202: 'Not support compound glyph flag: ARGS_ARE_XY_VALUES',
  10203: 'No ttf table: ${0}',
  10204: 'Read ttf table data error',
  10205: 'No zip deflate function',
  10301: 'otf file damaged',
  10302: 'Read otf table error',
  10303: 'otf `glyph` data is empty'
};
var _default = exports.default = new _I18n.default([['zh-cn', zh], ['en-us', en]], typeof window !== 'undefined' ? window.language : 'en-us');
},
"common/I18n.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * @file 用于国际化的字符串管理类
 * @author mengke01(kekee000@gmail.com)
 */

function appendLanguage(store, languageList) {
  languageList.forEach(function (item) {
    var language = item[0];
    store[language] = Object.assign(store[language] || {}, item[1]);
  });
  return store;
}

/**
 * 管理国际化字符，根据lang切换语言版本
 *
 * @class I18n
 * @param {Array} languageList 当前支持的语言列表
 * @param {string=} defaultLanguage 默认语言
 * languageList = [
 *     'en-us', // 语言名称
 *     langObject // 语言字符串列表
 * ]
 */
var I18n = exports.default = /*#__PURE__*/function () {
  function I18n(languageList, defaultLanguage) {
    _classCallCheck(this, I18n);
    this.store = appendLanguage({}, languageList);
    this.setLanguage(defaultLanguage || typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase() || 'en-us');
  }

  /**
   * 设置语言
   *
   * @param {string} language 语言
   * @return {this}
   */
  return _createClass(I18n, [{
    key: "setLanguage",
    value: function setLanguage(language) {
      if (!this.store[language]) {
        language = 'en-us';
      }
      this.lang = this.store[this.language = language];
      return this;
    }

    /**
     * 添加一个语言字符串
     *
     * @param {string} language 语言
     * @param {Object} langObject 语言对象
     * @return {this}
     */
  }, {
    key: "addLanguage",
    value: function addLanguage(language, langObject) {
      appendLanguage(this.store, [[language, langObject]]);
      return this;
    }

    /**
     * 获取当前语言字符串
     *
     * @param  {string} path 语言路径
     * @return {string}      语言字符串
     */
  }, {
    key: "get",
    value: function get(path) {
      var ref = path.split('.');
      var refObject = this.lang;
      var level;
      while (refObject != null && (level = ref.shift())) {
        refObject = refObject[level];
      }
      return refObject != null ? refObject : '';
    }
  }]);
}();
},
"ttf/table/directory.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file directory 表, 读取和写入ttf表索引
 * @author mengke01(kekee000@gmail.com)
 *
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6.html
 */
var _default = exports.default = _table.default.create('directory', [], {
  read: function read(reader, ttf) {
    var tables = {};
    var numTables = ttf.numTables;
    var offset = this.offset;
    for (var i = offset, l = numTables * 16; i < l; i += 16) {
      var name = reader.readString(i, 4).trim();
      tables[name] = {
        name: name,
        checkSum: reader.readUint32(i + 4),
        offset: reader.readUint32(i + 8),
        length: reader.readUint32(i + 12)
      };
    }
    return tables;
  },
  write: function write(writer, ttf) {
    var tables = ttf.support.tables;
    for (var i = 0, l = tables.length; i < l; i++) {
      writer.writeString((tables[i].name + '    ').slice(0, 4));
      writer.writeUint32(tables[i].checkSum);
      writer.writeUint32(tables[i].offset);
      writer.writeUint32(tables[i].length);
    }
    return writer;
  },
  size: function size(ttf) {
    return ttf.numTables * 16;
  }
});
},
"ttf/table/table.js":function(module,exports,__load){
"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
var _error = _interopRequireDefault(__load("ttf/error.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } } /**
 * @file ttf表基类
 * @author mengke01(kekee000@gmail.com)
 */
/* eslint-disable no-invalid-this */
/**
 * 读取表结构
 *
 * @param {Reader} reader reader对象
 * @return {Object} 当前对象
 */
function read(reader) {
  var offset = this.offset;
  if (undefined !== offset) {
    reader.seek(offset);
  }
  var me = this;
  this.struct.forEach(function (item) {
    var name = item[0];
    var type = item[1];
    var typeName = null;
    switch (type) {
      case _struct.default.Int8:
      case _struct.default.Uint8:
      case _struct.default.Int16:
      case _struct.default.Uint16:
      case _struct.default.Int32:
      case _struct.default.Uint32:
        typeName = _struct.default.names[type];
        me[name] = reader.read(typeName);
        break;
      case _struct.default.Fixed:
        me[name] = reader.readFixed();
        break;
      case _struct.default.LongDateTime:
        me[name] = reader.readLongDateTime();
        break;
      case _struct.default.Bytes:
        me[name] = reader.readBytes(reader.offset, item[2] || 0);
        break;
      case _struct.default.Char:
        me[name] = reader.readChar();
        break;
      case _struct.default.String:
        me[name] = reader.readString(reader.offset, item[2] || 0);
        break;
      default:
        _error.default.raise(10003, name, type);
    }
  });
  return this.valueOf();
}

/**
 * 写表结构
 *
 * @param {Object} writer writer对象
 * @param {Object} ttf 已解析的ttf对象
 *
 * @return {Writer} 返回writer对象
 */
function write(writer, ttf) {
  var table = ttf[this.name];
  if (!table) {
    _error.default.raise(10203, this.name);
  }
  this.struct.forEach(function (item) {
    var name = item[0];
    var type = item[1];
    var typeName = null;
    switch (type) {
      case _struct.default.Int8:
      case _struct.default.Uint8:
      case _struct.default.Int16:
      case _struct.default.Uint16:
      case _struct.default.Int32:
      case _struct.default.Uint32:
        typeName = _struct.default.names[type];
        writer.write(typeName, table[name]);
        break;
      case _struct.default.Fixed:
        writer.writeFixed(table[name]);
        break;
      case _struct.default.LongDateTime:
        writer.writeLongDateTime(table[name]);
        break;
      case _struct.default.Bytes:
        writer.writeBytes(table[name], item[2] || 0);
        break;
      case _struct.default.Char:
        writer.writeChar(table[name]);
        break;
      case _struct.default.String:
        writer.writeString(table[name], item[2] || 0);
        break;
      default:
        _error.default.raise(10003, name, type);
    }
  });
  return writer;
}

/**
 * 获取ttf表的size大小
 *
 * @param {string} name 表名
 * @return {number} 表大小
 */
function size() {
  var sz = 0;
  this.struct.forEach(function (item) {
    var type = item[1];
    switch (type) {
      case _struct.default.Int8:
      case _struct.default.Uint8:
        sz += 1;
        break;
      case _struct.default.Int16:
      case _struct.default.Uint16:
        sz += 2;
        break;
      case _struct.default.Int32:
      case _struct.default.Uint32:
      case _struct.default.Fixed:
        sz += 4;
        break;
      case _struct.default.LongDateTime:
        sz += 8;
        break;
      case _struct.default.Bytes:
        sz += item[2] || 0;
        break;
      case _struct.default.Char:
        sz += 1;
        break;
      case _struct.default.String:
        sz += item[2] || 0;
        break;
      default:
        _error.default.raise(10003, name, type);
    }
  });
  return sz;
}

/**
 * 获取对象的值
 *
 * @return {*} 当前对象的值
 */
function valueOf() {
  var val = {};
  var me = this;
  this.struct.forEach(function (item) {
    val[item[0]] = me[item[0]];
  });
  return val;
}
var _default = exports.default = {
  read: read,
  write: write,
  size: size,
  valueOf: valueOf,
  /**
   * 创建一个表结构
   *
   * @param {string} name 表名
   * @param {Array<[string, number]>} struct 表结构
   * @param {Object} proto 原型
   * @return {Function} 表构造函数
   */
  create: function create(name, struct, proto) {
    var Table = /*#__PURE__*/_createClass(function Table(offset) {
      _classCallCheck(this, Table);
      this.name = name;
      this.struct = struct;
      this.offset = offset;
    });
    Table.prototype.read = read;
    Table.prototype.write = write;
    Table.prototype.size = size;
    Table.prototype.valueOf = valueOf;
    Object.assign(Table.prototype, proto);
    return Table;
  }
};
},
"ttf/table/struct.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file ttf基本数据结构
 * @author mengke01(kekee000@gmail.com)
 *
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6.html
 */

var struct = {
  Int8: 1,
  Uint8: 2,
  Int16: 3,
  Uint16: 4,
  Int32: 5,
  Uint32: 6,
  Fixed: 7,
  // 32-bit signed fixed-point number (16.16)
  FUnit: 8,
  // Smallest measurable distance in the em space
  // 16-bit signed fixed number with the low 14 bits of fraction
  F2Dot14: 11,
  // The long internal format of a date in seconds since 12:00 midnight,
  // January 1, 1904. It is represented as a signed 64-bit integer.
  LongDateTime: 12,
  // extend data type
  Char: 13,
  String: 14,
  Bytes: 15,
  Uint24: 20
};

// 反转名字查找
var names = {};
Object.keys(struct).forEach(function (key) {
  names[struct[key]] = key;
});
struct.names = names;
var _default = exports.default = struct;
},
"ttf/table/support.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _head = _interopRequireDefault(__load("ttf/table/head.js"));
var _maxp = _interopRequireDefault(__load("ttf/table/maxp.js"));
var _loca = _interopRequireDefault(__load("ttf/table/loca.js"));
var _cmap = _interopRequireDefault(__load("ttf/table/cmap.js"));
var _glyf = _interopRequireDefault(__load("ttf/table/glyf.js"));
var _name = _interopRequireDefault(__load("ttf/table/name.js"));
var _hhea = _interopRequireDefault(__load("ttf/table/hhea.js"));
var _hmtx = _interopRequireDefault(__load("ttf/table/hmtx.js"));
var _post = _interopRequireDefault(__load("ttf/table/post.js"));
var _OS = _interopRequireDefault(__load("ttf/table/OS2.js"));
var _fpgm = _interopRequireDefault(__load("ttf/table/fpgm.js"));
var _cvt = _interopRequireDefault(__load("ttf/table/cvt.js"));
var _prep = _interopRequireDefault(__load("ttf/table/prep.js"));
var _gasp = _interopRequireDefault(__load("ttf/table/gasp.js"));
var _GPOS = _interopRequireDefault(__load("ttf/table/GPOS.js"));
var _kern = _interopRequireDefault(__load("ttf/table/kern.js"));
var _kerx = _interopRequireDefault(__load("ttf/table/kerx.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file ttf读取和写入支持的表
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = {
  head: _head.default,
  maxp: _maxp.default,
  loca: _loca.default,
  cmap: _cmap.default,
  glyf: _glyf.default,
  name: _name.default,
  hhea: _hhea.default,
  hmtx: _hmtx.default,
  post: _post.default,
  'OS/2': _OS.default,
  fpgm: _fpgm.default,
  cvt: _cvt.default,
  prep: _prep.default,
  gasp: _gasp.default,
  GPOS: _GPOS.default,
  kern: _kern.default,
  kerx: _kerx.default
};
},
"ttf/table/head.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file head表
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = _table.default.create('head', [['version', _struct.default.Fixed], ['fontRevision', _struct.default.Fixed], ['checkSumAdjustment', _struct.default.Uint32], ['magickNumber', _struct.default.Uint32], ['flags', _struct.default.Uint16], ['unitsPerEm', _struct.default.Uint16], ['created', _struct.default.LongDateTime], ['modified', _struct.default.LongDateTime], ['xMin', _struct.default.Int16], ['yMin', _struct.default.Int16], ['xMax', _struct.default.Int16], ['yMax', _struct.default.Int16], ['macStyle', _struct.default.Uint16], ['lowestRecPPEM', _struct.default.Uint16], ['fontDirectionHint', _struct.default.Int16], ['indexToLocFormat', _struct.default.Int16], ['glyphDataFormat', _struct.default.Int16]]);
},
"ttf/table/maxp.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file maxp 表
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = _table.default.create('maxp', [['version', _struct.default.Fixed], ['numGlyphs', _struct.default.Uint16], ['maxPoints', _struct.default.Uint16], ['maxContours', _struct.default.Uint16], ['maxCompositePoints', _struct.default.Uint16], ['maxCompositeContours', _struct.default.Uint16], ['maxZones', _struct.default.Uint16], ['maxTwilightPoints', _struct.default.Uint16], ['maxStorage', _struct.default.Uint16], ['maxFunctionDefs', _struct.default.Uint16], ['maxInstructionDefs', _struct.default.Uint16], ['maxStackElements', _struct.default.Uint16], ['maxSizeOfInstructions', _struct.default.Uint16], ['maxComponentElements', _struct.default.Uint16], ['maxComponentDepth', _struct.default.Int16]], {
  write: function write(writer, ttf) {
    _table.default.write.call(this, writer, ttf.support);
    return writer;
  },
  size: function size() {
    return 32;
  }
});
},
"ttf/table/loca.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file loca表
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = _table.default.create('loca', [], {
  read: function read(reader, ttf) {
    var offset = this.offset;
    var indexToLocFormat = ttf.head.indexToLocFormat;
    // indexToLocFormat有2字节和4字节的区别
    var type = _struct.default.names[indexToLocFormat === 0 ? _struct.default.Uint16 : _struct.default.Uint32];
    var size = indexToLocFormat === 0 ? 2 : 4; // 字节大小
    var sizeRatio = indexToLocFormat === 0 ? 2 : 1; // 真实地址偏移
    var wordOffset = [];
    reader.seek(offset);
    var numGlyphs = ttf.maxp.numGlyphs;
    for (var i = 0; i < numGlyphs; ++i) {
      wordOffset.push(reader.read(type, offset, false) * sizeRatio);
      offset += size;
    }
    return wordOffset;
  },
  write: function write(writer, ttf) {
    var glyfSupport = ttf.support.glyf;
    var offset = ttf.support.glyf.offset || 0;
    var indexToLocFormat = ttf.head.indexToLocFormat;
    var sizeRatio = indexToLocFormat === 0 ? 0.5 : 1;
    var numGlyphs = ttf.glyf.length;
    for (var i = 0; i < numGlyphs; ++i) {
      if (indexToLocFormat) {
        writer.writeUint32(offset);
      } else {
        writer.writeUint16(offset);
      }
      offset += glyfSupport[i].size * sizeRatio;
    }

    // write extra
    if (indexToLocFormat) {
      writer.writeUint32(offset);
    } else {
      writer.writeUint16(offset);
    }
    return writer;
  },
  size: function size(ttf) {
    var locaCount = ttf.glyf.length + 1;
    return ttf.head.indexToLocFormat ? locaCount * 4 : locaCount * 2;
  }
});
},
"ttf/table/cmap.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _parse = _interopRequireDefault(__load("ttf/table/cmap/parse.js"));
var _write = _interopRequireDefault(__load("ttf/table/cmap/write.js"));
var _sizeof = _interopRequireDefault(__load("ttf/table/cmap/sizeof.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file cmap 表
 * @author mengke01(kekee000@gmail.com)
 *
 * @see
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6cmap.html
 */
var _default = exports.default = _table.default.create('cmap', [], {
  write: _write.default,
  read: _parse.default,
  size: _sizeof.default
});
},
"ttf/table/cmap/parse.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parse;
var _readWindowsAllCodes = _interopRequireDefault(__load("ttf/util/readWindowsAllCodes.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file 解析cmap表
 * @author mengke01(kekee000@gmail.com)
 */

/**
 * 读取cmap子表
 *
 * @param {Reader} reader Reader对象
 * @param {Object} ttf ttf对象
 * @param {Object} subTable 子表对象
 * @param {number} cmapOffset 子表的偏移
 */
function readSubTable(reader, ttf, subTable, cmapOffset) {
  var i;
  var l;
  var glyphIdArray;
  var startOffset = cmapOffset + subTable.offset;
  var glyphCount;
  subTable.format = reader.readUint16(startOffset);

  // 0～256 紧凑排列
  if (subTable.format === 0) {
    var format0 = subTable;
    // 跳过format字段
    format0.length = reader.readUint16();
    format0.language = reader.readUint16();
    glyphIdArray = [];
    for (i = 0, l = format0.length - 6; i < l; i++) {
      glyphIdArray.push(reader.readUint8());
    }
    format0.glyphIdArray = glyphIdArray;
  } else if (subTable.format === 2) {
    var format2 = subTable;
    // 跳过format字段
    format2.length = reader.readUint16();
    format2.language = reader.readUint16();
    var subHeadKeys = [];
    var maxSubHeadKey = 0; // 最大索引
    var maxPos = -1; // 最大位置
    for (var _i = 0, _l = 256; _i < _l; _i++) {
      subHeadKeys[_i] = reader.readUint16() / 8;
      if (subHeadKeys[_i] > maxSubHeadKey) {
        maxSubHeadKey = subHeadKeys[_i];
        maxPos = _i;
      }
    }
    var subHeads = [];
    for (i = 0; i <= maxSubHeadKey; i++) {
      subHeads[i] = {
        firstCode: reader.readUint16(),
        entryCount: reader.readUint16(),
        idDelta: reader.readUint16(),
        idRangeOffset: (reader.readUint16() - (maxSubHeadKey - i) * 8 - 2) / 2
      };
    }
    glyphCount = (startOffset + format2.length - reader.offset) / 2;
    var glyphs = [];
    for (i = 0; i < glyphCount; i++) {
      glyphs[i] = reader.readUint16();
    }
    format2.subHeadKeys = subHeadKeys;
    format2.maxPos = maxPos;
    format2.subHeads = subHeads;
    format2.glyphs = glyphs;
  }
  // 双字节编码，非紧凑排列
  else if (subTable.format === 4) {
    var format4 = subTable;
    // 跳过format字段
    format4.length = reader.readUint16();
    format4.language = reader.readUint16();
    format4.segCountX2 = reader.readUint16();
    format4.searchRange = reader.readUint16();
    format4.entrySelector = reader.readUint16();
    format4.rangeShift = reader.readUint16();
    var segCount = format4.segCountX2 / 2;

    // end code
    var endCode = [];
    for (i = 0; i < segCount; ++i) {
      endCode.push(reader.readUint16());
    }
    format4.endCode = endCode;
    format4.reservedPad = reader.readUint16();

    // start code
    var startCode = [];
    for (i = 0; i < segCount; ++i) {
      startCode.push(reader.readUint16());
    }
    format4.startCode = startCode;

    // idDelta
    var idDelta = [];
    for (i = 0; i < segCount; ++i) {
      idDelta.push(reader.readUint16());
    }
    format4.idDelta = idDelta;
    format4.idRangeOffsetOffset = reader.offset;

    // idRangeOffset
    var idRangeOffset = [];
    for (i = 0; i < segCount; ++i) {
      idRangeOffset.push(reader.readUint16());
    }
    format4.idRangeOffset = idRangeOffset;

    // 总长度 - glyphIdArray起始偏移/2
    glyphCount = (format4.length - (reader.offset - startOffset)) / 2;

    // 记录array offset
    format4.glyphIdArrayOffset = reader.offset;

    // glyphIdArray
    glyphIdArray = [];
    for (i = 0; i < glyphCount; ++i) {
      glyphIdArray.push(reader.readUint16());
    }
    format4.glyphIdArray = glyphIdArray;
  } else if (subTable.format === 6) {
    var format6 = subTable;
    format6.length = reader.readUint16();
    format6.language = reader.readUint16();
    format6.firstCode = reader.readUint16();
    format6.entryCount = reader.readUint16();

    // 记录array offset
    format6.glyphIdArrayOffset = reader.offset;
    var glyphIndexArray = [];
    var entryCount = format6.entryCount;
    // 读取字符分组
    for (i = 0; i < entryCount; ++i) {
      glyphIndexArray.push(reader.readUint16());
    }
    format6.glyphIdArray = glyphIndexArray;
  }
  // defines segments for sparse representation in 4-byte character space
  else if (subTable.format === 12) {
    var format12 = subTable;
    format12.reserved = reader.readUint16();
    format12.length = reader.readUint32();
    format12.language = reader.readUint32();
    format12.nGroups = reader.readUint32();
    var groups = [];
    var nGroups = format12.nGroups;
    // 读取字符分组
    for (i = 0; i < nGroups; ++i) {
      var group = {};
      group.start = reader.readUint32();
      group.end = reader.readUint32();
      group.startId = reader.readUint32();
      groups.push(group);
    }
    format12.groups = groups;
  }
  // format 14
  else if (subTable.format === 14) {
    var format14 = subTable;
    format14.length = reader.readUint32();
    var numVarSelectorRecords = reader.readUint32();
    var _groups = [];
    var offset = reader.offset;
    for (var _i2 = 0; _i2 < numVarSelectorRecords; _i2++) {
      var varSelector = reader.readUint24(offset);
      var defaultUVSOffset = reader.readUint32(offset + 3);
      var nonDefaultUVSOffset = reader.readUint32(offset + 7);
      offset += 11;
      if (defaultUVSOffset) {
        var numUnicodeValueRanges = reader.readUint32(startOffset + defaultUVSOffset);
        for (var j = 0; j < numUnicodeValueRanges; j++) {
          var startUnicode = reader.readUint24();
          var additionalCount = reader.readUint8();
          _groups.push({
            start: startUnicode,
            end: startUnicode + additionalCount,
            varSelector: varSelector
          });
        }
      }
      if (nonDefaultUVSOffset) {
        var numUVSMappings = reader.readUint32(startOffset + nonDefaultUVSOffset);
        for (var _j = 0; _j < numUVSMappings; _j++) {
          var unicode = reader.readUint24();
          var glyphId = reader.readUint16();
          _groups.push({
            unicode: unicode,
            glyphId: glyphId,
            varSelector: varSelector
          });
        }
      }
    }
    format14.groups = _groups;
  } else {
    console.warn('not support cmap format:' + subTable.format);
  }
}
function parse(reader, ttf) {
  var tcmap = {};
  // eslint-disable-next-line no-invalid-this
  var cmapOffset = this.offset;
  reader.seek(cmapOffset);
  tcmap.version = reader.readUint16(); // 编码方式
  var numberSubtables = tcmap.numberSubtables = reader.readUint16(); // 表个数

  var subTables = tcmap.tables = []; // 名字表
  var offset = reader.offset;

  // 使用offset读取，以便于查找
  for (var i = 0, l = numberSubtables; i < l; i++) {
    var subTable = {};
    subTable.platformID = reader.readUint16(offset);
    subTable.encodingID = reader.readUint16(offset + 2);
    subTable.offset = reader.readUint32(offset + 4);
    readSubTable(reader, ttf, subTable, cmapOffset);
    subTables.push(subTable);
    offset += 8;
  }
  var cmap = (0, _readWindowsAllCodes.default)(subTables, ttf);
  return cmap;
}
},
"ttf/util/readWindowsAllCodes.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = readWindowsAllCodes;
/* eslint-disable */

/**
 * @file 读取windows支持的字符集
 * @author mengke01(kekee000@gmail.com)
 *
 * @see
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6cmap.html
 */

/**
 * 读取ttf中windows字符表的字符
 *
 * @param {Array} tables cmap表结构
 * @param {Object} ttf ttf对象
 * @return {Object} 字符字典索引，unicode => glyf index
 */
function readWindowsAllCodes(tables, ttf) {
  var codes = {};

  // 读取windows unicode 编码段
  var format0 = tables.find(function (item) {
    return item.format === 0;
  });

  // 读取windows unicode 编码段
  var format12 = tables.find(function (item) {
    return item.platformID === 3 && item.encodingID === 10 && item.format === 12;
  });
  var format4 = tables.find(function (item) {
    return item.platformID === 3 && item.encodingID === 1 && item.format === 4;
  });
  var format2 = tables.find(function (item) {
    return item.platformID === 3 && item.encodingID === 3 && item.format === 2;
  });
  var format14 = tables.find(function (item) {
    return item.platformID === 0 && item.encodingID === 5 && item.format === 14;
  });
  if (format0) {
    for (var i = 0, l = format0.glyphIdArray.length; i < l; i++) {
      if (format0.glyphIdArray[i]) {
        codes[i] = format0.glyphIdArray[i];
      }
    }
  }

  // format 14 support
  if (format14) {
    for (var _i = 0, _l = format14.groups.length; _i < _l; _i++) {
      var _format14$groups$_i = format14.groups[_i],
        unicode = _format14$groups$_i.unicode,
        glyphId = _format14$groups$_i.glyphId;
      if (unicode) {
        codes[unicode] = glyphId;
      }
    }
  }

  // 读取format12表
  if (format12) {
    for (var _i2 = 0, _l2 = format12.nGroups; _i2 < _l2; _i2++) {
      var group = format12.groups[_i2];
      var startId = group.startId;
      var start = group.start;
      var end = group.end;
      for (; start <= end;) {
        codes[start++] = startId++;
      }
    }
  }
  // 读取format4表
  else if (format4) {
    var segCount = format4.segCountX2 / 2;
    // graphIdArray 和idRangeOffset的偏移量
    var graphIdArrayIndexOffset = (format4.glyphIdArrayOffset - format4.idRangeOffsetOffset) / 2;
    for (var _i3 = 0; _i3 < segCount; ++_i3) {
      // 读取单个字符
      for (var _start = format4.startCode[_i3], _end = format4.endCode[_i3]; _start <= _end; ++_start) {
        // range offset = 0
        if (format4.idRangeOffset[_i3] === 0) {
          codes[_start] = (_start + format4.idDelta[_i3]) % 0x10000;
        }
        // rely on to glyphIndexArray
        else {
          var index = _i3 + format4.idRangeOffset[_i3] / 2 + (_start - format4.startCode[_i3]) - graphIdArrayIndexOffset;
          var graphId = format4.glyphIdArray[index];
          if (graphId !== 0) {
            codes[_start] = (graphId + format4.idDelta[_i3]) % 0x10000;
          } else {
            codes[_start] = 0;
          }
        }
      }
    }
    delete codes[65535];
  }
  // 读取format2表
  // see https://github.com/fontforge/fontforge/blob/master/fontforge/parsettf.c
  else if (format2) {
    var subHeadKeys = format2.subHeadKeys;
    var subHeads = format2.subHeads;
    var glyphs = format2.glyphs;
    var numGlyphs = ttf.maxp.numGlyphs;
    var _index = 0;
    for (var _i4 = 0; _i4 < 256; _i4++) {
      // 单字节编码
      if (subHeadKeys[_i4] === 0) {
        if (_i4 >= format2.maxPos) {
          _index = 0;
        } else if (_i4 < subHeads[0].firstCode || _i4 >= subHeads[0].firstCode + subHeads[0].entryCount || subHeads[0].idRangeOffset + (_i4 - subHeads[0].firstCode) >= glyphs.length) {
          _index = 0;
        } else if ((_index = glyphs[subHeads[0].idRangeOffset + (_i4 - subHeads[0].firstCode)]) !== 0) {
          _index = _index + subHeads[0].idDelta;
        }

        // 单字节解码
        if (_index !== 0 && _index < numGlyphs) {
          codes[_i4] = _index;
        }
      } else {
        var k = subHeadKeys[_i4];
        for (var j = 0, entryCount = subHeads[k].entryCount; j < entryCount; j++) {
          if (subHeads[k].idRangeOffset + j >= glyphs.length) {
            _index = 0;
          } else if ((_index = glyphs[subHeads[k].idRangeOffset + j]) !== 0) {
            _index = _index + subHeads[k].idDelta;
          }
          if (_index !== 0 && _index < numGlyphs) {
            var _unicode = (_i4 << 8 | j + subHeads[k].firstCode) % 0xffff;
            codes[_unicode] = _index;
          }
        }
      }
    }
  }
  return codes;
}
},
"ttf/table/cmap/write.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = write;
/**
 * @file 写cmap表
 * @author mengke01(kekee000@gmail.com)
 */

/**
 * 创建`子表0`
 *
 * @param {Writer} writer 写对象
 * @param {Array} unicodes unicodes列表
 * @return {Writer}
 */
function writeSubTable0(writer, unicodes) {
  writer.writeUint16(0); // format
  writer.writeUint16(262); // length
  writer.writeUint16(0); // language

  // Array of unicodes 0..255
  var i = -1;
  var unicode;
  while (unicode = unicodes.shift()) {
    while (++i < unicode[0]) {
      writer.writeUint8(0);
    }
    writer.writeUint8(unicode[1]);
    i = unicode[0];
  }
  while (++i < 256) {
    writer.writeUint8(0);
  }
  return writer;
}

/**
 * 创建`子表4`
 *
 * @param {Writer} writer 写对象
 * @param {Array} segments 分块编码列表
 * @return {Writer}
 */
function writeSubTable4(writer, segments) {
  writer.writeUint16(4); // format
  writer.writeUint16(24 + segments.length * 8); // length
  writer.writeUint16(0); // language

  var segCount = segments.length + 1;
  var maxExponent = Math.floor(Math.log(segCount) / Math.LN2);
  var searchRange = 2 * Math.pow(2, maxExponent);
  writer.writeUint16(segCount * 2); // segCountX2
  writer.writeUint16(searchRange); // searchRange
  writer.writeUint16(maxExponent); // entrySelector
  writer.writeUint16(2 * segCount - searchRange); // rangeShift

  // end list
  segments.forEach(function (segment) {
    writer.writeUint16(segment.end);
  });
  writer.writeUint16(0xFFFF); // end code
  writer.writeUint16(0); // reservedPad

  // start list
  segments.forEach(function (segment) {
    writer.writeUint16(segment.start);
  });
  writer.writeUint16(0xFFFF); // start code

  // id delta
  segments.forEach(function (segment) {
    writer.writeUint16(segment.delta);
  });
  writer.writeUint16(1);

  // Array of range offsets, it doesn't matter when deltas present
  for (var i = 0, l = segments.length; i < l; i++) {
    writer.writeUint16(0);
  }
  writer.writeUint16(0); // rangeOffsetArray should be finished with 0

  return writer;
}

/**
 * 创建`子表12`
 *
 * @param {Writer} writer 写对象
 * @param {Array} segments 分块编码列表
 * @return {Writer}
 */
function writeSubTable12(writer, segments) {
  writer.writeUint16(12); // format
  writer.writeUint16(0); // reserved
  writer.writeUint32(16 + segments.length * 12); // length
  writer.writeUint32(0); // language
  writer.writeUint32(segments.length); // nGroups

  segments.forEach(function (segment) {
    writer.writeUint32(segment.start);
    writer.writeUint32(segment.end);
    writer.writeUint32(segment.startId);
  });
  return writer;
}

/**
 * 写subtableheader
 *
 * @param {Writer} writer Writer对象
 * @param {number} platform 平台
 * @param {number} encoding 编码
 * @param {number} offset 偏移
 * @return {Writer}
 */
function writeSubTableHeader(writer, platform, encoding, offset) {
  writer.writeUint16(platform); // platform
  writer.writeUint16(encoding); // encoding
  writer.writeUint32(offset); // offset
  return writer;
}

/**
 * 写cmap表数据
 *
 * @param  {Object} writer 写入器
 * @param  {Object} ttf    ttf对象
 * @return {Object}        写入器
 */
function write(writer, ttf) {
  var hasGLyphsOver2Bytes = ttf.support.cmap.hasGLyphsOver2Bytes;

  // write table header.
  writer.writeUint16(0); // version
  writer.writeUint16(hasGLyphsOver2Bytes ? 4 : 3); // count

  // header size
  var subTableOffset = 4 + (hasGLyphsOver2Bytes ? 32 : 24);
  var format4Size = ttf.support.cmap.format4Size;
  var format0Size = ttf.support.cmap.format0Size;

  // subtable 4, unicode
  writeSubTableHeader(writer, 0, 3, subTableOffset);

  // subtable 0, mac standard
  writeSubTableHeader(writer, 1, 0, subTableOffset + format4Size);

  // subtable 4, windows standard
  writeSubTableHeader(writer, 3, 1, subTableOffset);
  if (hasGLyphsOver2Bytes) {
    writeSubTableHeader(writer, 3, 10, subTableOffset + format4Size + format0Size);
  }

  // write tables, order of table seem to be magic, it is taken from TTX tool
  writeSubTable4(writer, ttf.support.cmap.format4Segments);
  writeSubTable0(writer, ttf.support.cmap.format0Segments);
  if (hasGLyphsOver2Bytes) {
    writeSubTable12(writer, ttf.support.cmap.format12Segments);
  }
  return writer;
}
},
"ttf/table/cmap/sizeof.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sizeof;
/**
 * @file 获取cmap表的大小
 * @author mengke01(kekee000@gmail.com)
 */

/**
 * 获取format4 delta值
 * Delta is saved in signed int in cmap format 4 subtable,
 * but can be in -0xFFFF..0 interval.
 * -0x10000..-0x7FFF values are stored with offset.
 *
 * @param {number} delta delta值
 * @return {number} delta值
 */
function encodeDelta(delta) {
  return delta > 0x7FFF ? delta - 0x10000 : delta < -0x7FFF ? delta + 0x10000 : delta;
}

/**
 * 根据bound获取glyf segment
 *
 * @param {Array} glyfUnicodes glyf编码集合
 * @param {number} bound 编码范围
 * @return {Array} 码表
 */
function getSegments(glyfUnicodes, bound) {
  var prevGlyph = null;
  var result = [];
  var segment = {};
  glyfUnicodes.forEach(function (glyph) {
    if (bound === undefined || glyph.unicode <= bound) {
      // 初始化编码头部，这里unicode和graph id 都必须连续
      if (prevGlyph === null || glyph.unicode !== prevGlyph.unicode + 1 || glyph.id !== prevGlyph.id + 1) {
        if (prevGlyph !== null) {
          segment.end = prevGlyph.unicode;
          result.push(segment);
          segment = {
            start: glyph.unicode,
            startId: glyph.id,
            delta: encodeDelta(glyph.id - glyph.unicode)
          };
        } else {
          segment.start = glyph.unicode;
          segment.startId = glyph.id;
          segment.delta = encodeDelta(glyph.id - glyph.unicode);
        }
      }
      prevGlyph = glyph;
    }
  });

  // need to finish the last segment
  if (prevGlyph !== null) {
    segment.end = prevGlyph.unicode;
    result.push(segment);
  }

  // 返回编码范围
  return result;
}

/**
 * 获取format0编码集合
 *
 * @param {Array} glyfUnicodes glyf编码集合
 * @return {Array} 码表
 */
function getFormat0Segment(glyfUnicodes) {
  var unicodes = [];
  glyfUnicodes.forEach(function (u) {
    if (u.unicode !== undefined && u.unicode < 256) {
      unicodes.push([u.unicode, u.id]);
    }
  });

  // 按编码排序
  unicodes.sort(function (a, b) {
    return a[0] - b[0];
  });
  return unicodes;
}

/**
 * 对cmap数据进行预处理，获取大小
 *
 * @param  {Object} ttf ttf对象
 * @return {number} 大小
 */
function sizeof(ttf) {
  ttf.support.cmap = {};
  var glyfUnicodes = [];
  ttf.glyf.forEach(function (glyph, index) {
    var unicodes = glyph.unicode;
    if (typeof glyph.unicode === 'number') {
      unicodes = [glyph.unicode];
    }
    if (unicodes && unicodes.length) {
      unicodes.forEach(function (unicode) {
        glyfUnicodes.push({
          unicode: unicode,
          id: unicode !== 0xFFFF ? index : 0
        });
      });
    }
  });
  glyfUnicodes = glyfUnicodes.sort(function (a, b) {
    return a.unicode - b.unicode;
  });
  ttf.support.cmap.unicodes = glyfUnicodes;
  var unicodes2Bytes = glyfUnicodes;
  ttf.support.cmap.format4Segments = getSegments(unicodes2Bytes, 0xFFFF);
  ttf.support.cmap.format4Size = 24 + ttf.support.cmap.format4Segments.length * 8;
  ttf.support.cmap.format0Segments = getFormat0Segment(glyfUnicodes);
  ttf.support.cmap.format0Size = 262;

  // we need subtable 12 only if found unicodes with > 2 bytes.
  var hasGLyphsOver2Bytes = unicodes2Bytes.some(function (glyph) {
    return glyph.unicode > 0xFFFF;
  });
  if (hasGLyphsOver2Bytes) {
    ttf.support.cmap.hasGLyphsOver2Bytes = hasGLyphsOver2Bytes;
    var unicodes4Bytes = glyfUnicodes;
    ttf.support.cmap.format12Segments = getSegments(unicodes4Bytes);
    ttf.support.cmap.format12Size = 16 + ttf.support.cmap.format12Segments.length * 12;
  }
  var size = 4 + (hasGLyphsOver2Bytes ? 32 : 24) // cmap header
  + ttf.support.cmap.format0Size // format 0
  + ttf.support.cmap.format4Size // format 4
  + (hasGLyphsOver2Bytes ? ttf.support.cmap.format12Size : 0); // format 12

  return size;
}
},
"ttf/table/glyf.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _parse = _interopRequireDefault(__load("ttf/table/glyf/parse.js"));
var _write = _interopRequireDefault(__load("ttf/table/glyf/write.js"));
var _sizeof = _interopRequireDefault(__load("ttf/table/glyf/sizeof.js"));
var _lang = __load("common/lang.js");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file glyf表
 * @author mengke01(kekee000@gmail.com)
 *
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6glyf.html
 */
var _default = exports.default = _table.default.create('glyf', [], {
  read: function read(reader, ttf) {
    var startOffset = this.offset;
    var loca = ttf.loca;
    var numGlyphs = ttf.maxp.numGlyphs;
    var glyphs = [];
    reader.seek(startOffset);

    // subset
    var subset = ttf.readOptions.subset;
    if (subset && subset.length > 0) {
      var subsetMap = {
        0: true // 设置.notdef
      };
      subsetMap[0] = true;
      // subset map
      var cmap = ttf.cmap;

      // unicode to index
      Object.keys(cmap).forEach(function (c) {
        if (subset.indexOf(+c) > -1) {
          var _i = cmap[c];
          subsetMap[_i] = true;
        }
      });
      ttf.subsetMap = subsetMap;
      var parsedGlyfMap = {};
      // 循环解析subset相关的glyf，包括复合字形相关的字形
      var travelsParse = function travels(subsetMap) {
        var newSubsetMap = {};
        Object.keys(subsetMap).forEach(function (i) {
          var index = +i;
          parsedGlyfMap[index] = true;
          // 当前的和下一个一样，或者最后一个无轮廓
          if (loca[index] === loca[index + 1]) {
            glyphs[index] = {
              contours: []
            };
          } else {
            glyphs[index] = (0, _parse.default)(reader, ttf, startOffset + loca[index]);
          }
          if (glyphs[index].compound) {
            glyphs[index].glyfs.forEach(function (g) {
              if (!parsedGlyfMap[g.glyphIndex]) {
                newSubsetMap[g.glyphIndex] = true;
              }
            });
          }
        });
        if (!(0, _lang.isEmptyObject)(newSubsetMap)) {
          travels(newSubsetMap);
        }
      };
      travelsParse(subsetMap);
      return glyphs;
    }

    // 解析字体轮廓, 前n-1个
    var i;
    var l;
    for (i = 0, l = numGlyphs - 1; i < l; i++) {
      // 当前的和下一个一样，或者最后一个无轮廓
      if (loca[i] === loca[i + 1]) {
        glyphs[i] = {
          contours: []
        };
      } else {
        glyphs[i] = (0, _parse.default)(reader, ttf, startOffset + loca[i]);
      }
    }

    // 最后一个轮廓
    if (ttf.tables.glyf.length - loca[i] < 5) {
      glyphs[i] = {
        contours: []
      };
    } else {
      glyphs[i] = (0, _parse.default)(reader, ttf, startOffset + loca[i]);
    }
    return glyphs;
  },
  write: _write.default,
  size: _sizeof.default
});
},
"ttf/table/glyf/parse.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parseGlyf;
var _glyFlag = _interopRequireDefault(__load("ttf/enum/glyFlag.js"));
var _componentFlag = _interopRequireDefault(__load("ttf/enum/componentFlag.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file 解析glyf轮廓
 * @author mengke01(kekee000@gmail.com)
 */

var MAX_INSTRUCTION_LENGTH = 5000; // 设置instructions阈值防止读取错误
var MAX_NUMBER_OF_COORDINATES = 20000; // 设置坐标最大个数阈值，防止glyf读取错误

/**
 * 读取简单字形
 *
 * @param {Reader} reader Reader对象
 * @param {Object} glyf 空glyf
 * @return {Object} 解析后的glyf
 */
function parseSimpleGlyf(reader, glyf) {
  var offset = reader.offset;

  // 轮廓点个数
  var numberOfCoordinates = glyf.endPtsOfContours[glyf.endPtsOfContours.length - 1] + 1;

  // 判断坐标是否超过最大个数
  if (numberOfCoordinates > MAX_NUMBER_OF_COORDINATES) {
    console.warn('error read glyf coordinates:' + offset);
    return glyf;
  }

  // 获取flag标志
  var i;
  var length;
  var flags = [];
  var flag;
  i = 0;
  while (i < numberOfCoordinates) {
    flag = reader.readUint8();
    flags.push(flag);
    i++;

    // 标志位3重复flag
    if (flag & _glyFlag.default.REPEAT && i < numberOfCoordinates) {
      // 重复个数
      var repeat = reader.readUint8();
      for (var j = 0; j < repeat; j++) {
        flags.push(flag);
        i++;
      }
    }
  }

  // 坐标集合
  var coordinates = [];
  var xCoordinates = [];
  var prevX = 0;
  var x;
  for (i = 0, length = flags.length; i < length; ++i) {
    x = 0;
    flag = flags[i];

    // 标志位1
    // If set, the corresponding y-coordinate is 1 byte long, not 2
    if (flag & _glyFlag.default.XSHORT) {
      x = reader.readUint8();

      // 标志位5
      x = flag & _glyFlag.default.XSAME ? x : -1 * x;
    }
    // 与上一值一致
    else if (flag & _glyFlag.default.XSAME) {
      x = 0;
    }
    // 新值
    else {
      x = reader.readInt16();
    }
    prevX += x;
    xCoordinates[i] = prevX;
    coordinates[i] = {
      x: prevX,
      y: 0
    };
    if (flag & _glyFlag.default.ONCURVE) {
      coordinates[i].onCurve = true;
    }
  }
  var yCoordinates = [];
  var prevY = 0;
  var y;
  for (i = 0, length = flags.length; i < length; i++) {
    y = 0;
    flag = flags[i];
    if (flag & _glyFlag.default.YSHORT) {
      y = reader.readUint8();
      y = flag & _glyFlag.default.YSAME ? y : -1 * y;
    } else if (flag & _glyFlag.default.YSAME) {
      y = 0;
    } else {
      y = reader.readInt16();
    }
    prevY += y;
    yCoordinates[i] = prevY;
    if (coordinates[i]) {
      coordinates[i].y = prevY;
    }
  }

  // 计算轮廓集合
  if (coordinates.length) {
    var endPtsOfContours = glyf.endPtsOfContours;
    var contours = [];
    contours.push(coordinates.slice(0, endPtsOfContours[0] + 1));
    for (i = 1, length = endPtsOfContours.length; i < length; i++) {
      contours.push(coordinates.slice(endPtsOfContours[i - 1] + 1, endPtsOfContours[i] + 1));
    }
    glyf.contours = contours;
  }
  return glyf;
}

/**
 * 读取复合字形
 *
 * @param {Reader} reader Reader对象
 * @param {Object} glyf glyf对象
 * @return {Object} glyf对象
 */
function parseCompoundGlyf(reader, glyf) {
  glyf.compound = true;
  glyf.glyfs = [];
  var flags;
  var g;

  // 读取复杂字形
  do {
    flags = reader.readUint16();
    g = {};
    g.flags = flags;
    g.glyphIndex = reader.readUint16();
    var arg1 = 0;
    var arg2 = 0;
    var scaleX = 16384;
    var scaleY = 16384;
    var scale01 = 0;
    var scale10 = 0;
    if (_componentFlag.default.ARG_1_AND_2_ARE_WORDS & flags) {
      arg1 = reader.readInt16();
      arg2 = reader.readInt16();
    } else {
      arg1 = reader.readInt8();
      arg2 = reader.readInt8();
    }
    if (_componentFlag.default.ROUND_XY_TO_GRID & flags) {
      arg1 = Math.round(arg1);
      arg2 = Math.round(arg2);
    }
    if (_componentFlag.default.WE_HAVE_A_SCALE & flags) {
      scaleX = reader.readInt16();
      scaleY = scaleX;
    } else if (_componentFlag.default.WE_HAVE_AN_X_AND_Y_SCALE & flags) {
      scaleX = reader.readInt16();
      scaleY = reader.readInt16();
    } else if (_componentFlag.default.WE_HAVE_A_TWO_BY_TWO & flags) {
      scaleX = reader.readInt16();
      scale01 = reader.readInt16();
      scale10 = reader.readInt16();
      scaleY = reader.readInt16();
    }
    if (_componentFlag.default.ARGS_ARE_XY_VALUES & flags) {
      g.useMyMetrics = !!flags & _componentFlag.default.USE_MY_METRICS;
      g.overlapCompound = !!flags & _componentFlag.default.OVERLAP_COMPOUND;
      g.transform = {
        a: Math.round(10000 * scaleX / 16384) / 10000,
        b: Math.round(10000 * scale01 / 16384) / 10000,
        c: Math.round(10000 * scale10 / 16384) / 10000,
        d: Math.round(10000 * scaleY / 16384) / 10000,
        e: arg1,
        f: arg2
      };
    } else {
      g.points = [arg1, arg2];
      g.transform = {
        a: Math.round(10000 * scaleX / 16384) / 10000,
        b: Math.round(10000 * scale01 / 16384) / 10000,
        c: Math.round(10000 * scale10 / 16384) / 10000,
        d: Math.round(10000 * scaleY / 16384) / 10000,
        e: 0,
        f: 0
      };
    }
    glyf.glyfs.push(g);
  } while (_componentFlag.default.MORE_COMPONENTS & flags);
  if (_componentFlag.default.WE_HAVE_INSTRUCTIONS & flags) {
    var length = reader.readUint16();
    if (length < MAX_INSTRUCTION_LENGTH) {
      var instructions = [];
      for (var i = 0; i < length; ++i) {
        instructions.push(reader.readUint8());
      }
      glyf.instructions = instructions;
    } else {
      console.warn(length);
    }
  }
  return glyf;
}

/**
 * 解析glyf轮廓
 *
 * @param  {Reader} reader 读取器
 * @param  {Object} ttf    ttf对象
 * @param  {number=} offset 偏移
 * @return {Object}        glyf对象
 */
function parseGlyf(reader, ttf, offset) {
  if (null != offset) {
    reader.seek(offset);
  }
  var glyf = {};
  var i;
  var length;
  var instructions;

  // 边界值
  var numberOfContours = reader.readInt16();
  glyf.xMin = reader.readInt16();
  glyf.yMin = reader.readInt16();
  glyf.xMax = reader.readInt16();
  glyf.yMax = reader.readInt16();

  // 读取简单字形
  if (numberOfContours >= 0) {
    // endPtsOfConturs
    glyf.endPtsOfContours = [];
    if (numberOfContours > 0) {
      for (i = 0; i < numberOfContours; i++) {
        glyf.endPtsOfContours.push(reader.readUint16());
      }
    } else {
      delete glyf.xMin;
      delete glyf.yMin;
      delete glyf.xMax;
      delete glyf.yMax;
    }

    // instructions
    length = reader.readUint16();
    if (length) {
      // range错误
      if (length < MAX_INSTRUCTION_LENGTH) {
        instructions = [];
        for (i = 0; i < length; ++i) {
          instructions.push(reader.readUint8());
        }
        glyf.instructions = instructions;
      } else {
        console.warn(length);
      }
    }
    parseSimpleGlyf(reader, glyf);
    delete glyf.endPtsOfContours;
  } else {
    parseCompoundGlyf(reader, glyf);
  }
  return glyf;
}
},
"ttf/enum/glyFlag.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file 轮廓标记位
 * @author mengke01(kekee000@gmail.com)
 *
 * see:
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6glyf.html
 */
var _default = exports.default = {
  ONCURVE: 0x01,
  // on curve ,off curve
  XSHORT: 0x02,
  // x-Short Vector
  YSHORT: 0x04,
  // y-Short Vector
  REPEAT: 0x08,
  // next byte is flag repeat count
  XSAME: 0x10,
  // This x is same (Positive x-Short vector)
  YSAME: 0x20,
  // This y is same (Positive y-Short vector)
  Reserved1: 0x40,
  Reserved2: 0x80
};
},
"ttf/enum/componentFlag.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file 复合图元标记位
 * @author mengke01(kekee000@gmail.com)
 *
 * 复合图元标记位
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6glyf.html
 */
var _default = exports.default = {
  ARG_1_AND_2_ARE_WORDS: 0x01,
  ARGS_ARE_XY_VALUES: 0x02,
  ROUND_XY_TO_GRID: 0x04,
  WE_HAVE_A_SCALE: 0x08,
  RESERVED: 0x10,
  MORE_COMPONENTS: 0x20,
  WE_HAVE_AN_X_AND_Y_SCALE: 0x40,
  WE_HAVE_A_TWO_BY_TWO: 0x80,
  WE_HAVE_INSTRUCTIONS: 0x100,
  USE_MY_METRICS: 0x200,
  OVERLAP_COMPOUND: 0x400,
  SCALED_COMPONENT_OFFSET: 0x800,
  UNSCALED_COMPONENT_OFFSET: 0x1000
};
},
"ttf/table/glyf/write.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = write;
var _componentFlag = _interopRequireDefault(__load("ttf/enum/componentFlag.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file 写glyf数据
 * @author mengke01(kekee000@gmail.com)
 */

/**
 * 写glyf
 *
 * @param  {Object} writer 写入器
 * @param  {Object} ttf    ttf对象
 * @return {Object}        写入器
 */
function write(writer, ttf) {
  var hinting = ttf.writeOptions ? ttf.writeOptions.hinting : false;
  var writeZeroContoursGlyfData = ttf.writeOptions ? ttf.writeOptions.writeZeroContoursGlyfData : false;
  ttf.glyf.forEach(function (glyf, index) {
    // 非复合图元没有轮廓则不写
    if (!glyf.compound && !writeZeroContoursGlyfData && (!glyf.contours || !glyf.contours.length)) {
      return;
    }
    // header
    writer.writeInt16(glyf.compound ? -1 : (glyf.contours || []).length);
    writer.writeInt16(glyf.xMin);
    writer.writeInt16(glyf.yMin);
    writer.writeInt16(glyf.xMax);
    writer.writeInt16(glyf.yMax);
    var i;
    var l;
    var flags;

    // 复合图元
    if (glyf.compound) {
      for (i = 0, l = glyf.glyfs.length; i < l; i++) {
        var g = glyf.glyfs[i];
        flags = g.points ? 0 : _componentFlag.default.ARGS_ARE_XY_VALUES + _componentFlag.default.ROUND_XY_TO_GRID; // xy values

        // more components
        if (i < l - 1) {
          flags += _componentFlag.default.MORE_COMPONENTS;
        }

        // use my metrics
        flags += g.useMyMetrics ? _componentFlag.default.USE_MY_METRICS : 0;
        // overlap compound
        flags += g.overlapCompound ? _componentFlag.default.OVERLAP_COMPOUND : 0;
        var transform = g.transform;
        var a = transform.a;
        var b = transform.b;
        var c = transform.c;
        var d = transform.d;
        var e = g.points ? g.points[0] : transform.e;
        var f = g.points ? g.points[1] : transform.f;

        // xy values or points
        // int 8 放不下，则用int16放
        if (e < 0 || e > 0x7F || f < 0 || f > 0x7F) {
          flags += _componentFlag.default.ARG_1_AND_2_ARE_WORDS;
        }
        if (b || c) {
          flags += _componentFlag.default.WE_HAVE_A_TWO_BY_TWO;
        } else if ((a !== 1 || d !== 1) && a === d) {
          flags += _componentFlag.default.WE_HAVE_A_SCALE;
        } else if (a !== 1 || d !== 1) {
          flags += _componentFlag.default.WE_HAVE_AN_X_AND_Y_SCALE;
        }
        writer.writeUint16(flags);
        writer.writeUint16(g.glyphIndex);
        if (_componentFlag.default.ARG_1_AND_2_ARE_WORDS & flags) {
          writer.writeInt16(e);
          writer.writeInt16(f);
        } else {
          writer.writeUint8(e);
          writer.writeUint8(f);
        }
        if (_componentFlag.default.WE_HAVE_A_SCALE & flags) {
          writer.writeInt16(Math.round(a * 16384));
        } else if (_componentFlag.default.WE_HAVE_AN_X_AND_Y_SCALE & flags) {
          writer.writeInt16(Math.round(a * 16384));
          writer.writeInt16(Math.round(d * 16384));
        } else if (_componentFlag.default.WE_HAVE_A_TWO_BY_TWO & flags) {
          writer.writeInt16(Math.round(a * 16384));
          writer.writeInt16(Math.round(b * 16384));
          writer.writeInt16(Math.round(c * 16384));
          writer.writeInt16(Math.round(d * 16384));
        }
      }
    } else {
      var endPtsOfContours = -1;
      (glyf.contours || []).forEach(function (contour) {
        endPtsOfContours += contour.length;
        writer.writeUint16(endPtsOfContours);
      });

      // instruction
      if (hinting && glyf.instructions) {
        var instructions = glyf.instructions;
        writer.writeUint16(instructions.length);
        for (i = 0, l = instructions.length; i < l; i++) {
          writer.writeUint8(instructions[i]);
        }
      } else {
        writer.writeUint16(0);
      }

      // 获取暂存中的flags
      flags = ttf.support.glyf[index].flags || [];
      for (i = 0, l = flags.length; i < l; i++) {
        writer.writeUint8(flags[i]);
      }
      var xCoord = ttf.support.glyf[index].xCoord || [];
      for (i = 0, l = xCoord.length; i < l; i++) {
        if (0 <= xCoord[i] && xCoord[i] <= 0xFF) {
          writer.writeUint8(xCoord[i]);
        } else {
          writer.writeInt16(xCoord[i]);
        }
      }
      var yCoord = ttf.support.glyf[index].yCoord || [];
      for (i = 0, l = yCoord.length; i < l; i++) {
        if (0 <= yCoord[i] && yCoord[i] <= 0xFF) {
          writer.writeUint8(yCoord[i]);
        } else {
          writer.writeInt16(yCoord[i]);
        }
      }
    }

    // 4字节对齐
    var glyfSize = ttf.support.glyf[index].glyfSize;
    if (glyfSize % 4) {
      writer.writeEmpty(4 - glyfSize % 4);
    }
  });
  return writer;
}
},
"ttf/table/glyf/sizeof.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sizeof;
var _glyFlag = _interopRequireDefault(__load("ttf/enum/glyFlag.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file 获取glyf的大小，同时对glyf写入进行预处理
 * @author mengke01(kekee000@gmail.com)
 */

/**
 * 获取glyf的大小
 *
 * @param {Object} glyf glyf对象
 * @param {Object} glyfSupport glyf相关统计
 * @param {boolean} hinting 是否保留hints
 * @param {boolean} writeZeroContoursGlyfData 是否写空轮廓 glyph
 * @return {number} size大小
 */
function sizeofSimple(glyf, glyfSupport, hinting, writeZeroContoursGlyfData) {
  if (!writeZeroContoursGlyfData && (!glyf.contours || !glyf.contours.length)) {
    return 0;
  }

  // fixed header + endPtsOfContours
  var result = 12 + (glyf.contours || []).length * 2 + (glyfSupport.flags || []).length;
  (glyfSupport.xCoord || []).forEach(function (x) {
    result += 0 <= x && x <= 0xFF ? 1 : 2;
  });
  (glyfSupport.yCoord || []).forEach(function (y) {
    result += 0 <= y && y <= 0xFF ? 1 : 2;
  });
  return result + (hinting && glyf.instructions ? glyf.instructions.length : 0);
}

/**
 * 复合图元size
 *
 * @param {Object} glyf glyf对象
 * @param {boolean} hinting 是否保留hints, compound 图元暂时不做hinting
 * @return {number} size大小
 */
// eslint-disable-next-line no-unused-vars
function sizeofCompound(glyf, hinting) {
  var size = 10;
  var transform;
  glyf.glyfs.forEach(function (g) {
    transform = g.transform;
    // flags + glyfIndex
    size += 4;

    // a, b, c, d, e
    // xy values or points
    if (transform.e < 0 || transform.e > 0x7F || transform.f < 0 || transform.f > 0x7F) {
      size += 4;
    } else {
      size += 2;
    }

    // 01 , 10
    if (transform.b || transform.c) {
      size += 8;
    }
    // scale
    else if (transform.a !== 1 || transform.d !== 1) {
      size += transform.a === transform.d ? 2 : 4;
    }
  });
  return size;
}

/**
 * 获取flags
 *
 * @param {Object} glyf glyf对象
 * @param {Object} glyfSupport glyf相关统计
 * @return {Array}
 */
function getFlags(glyf, glyfSupport) {
  if (!glyf.contours || 0 === glyf.contours.length) {
    return glyfSupport;
  }
  var flags = [];
  var xCoord = [];
  var yCoord = [];
  var contours = glyf.contours;
  var contour;
  var prev;
  var first = true;
  for (var j = 0, cl = contours.length; j < cl; j++) {
    contour = contours[j];
    for (var i = 0, l = contour.length; i < l; i++) {
      var point = contour[i];
      if (first) {
        xCoord.push(point.x);
        yCoord.push(point.y);
        first = false;
      } else {
        xCoord.push(point.x - prev.x);
        yCoord.push(point.y - prev.y);
      }
      flags.push(point.onCurve ? _glyFlag.default.ONCURVE : 0);
      prev = point;
    }
  }

  // compress
  var flagsC = [];
  var xCoordC = [];
  var yCoordC = [];
  var x;
  var y;
  var prevFlag;
  var repeatPoint = -1;
  flags.forEach(function (flag, index) {
    x = xCoord[index];
    y = yCoord[index];

    // 第一个
    if (index === 0) {
      if (-0xFF <= x && x <= 0xFF) {
        flag += _glyFlag.default.XSHORT;
        if (x >= 0) {
          flag += _glyFlag.default.XSAME;
        }
        x = Math.abs(x);
      }
      if (-0xFF <= y && y <= 0xFF) {
        flag += _glyFlag.default.YSHORT;
        if (y >= 0) {
          flag += _glyFlag.default.YSAME;
        }
        y = Math.abs(y);
      }
      flagsC.push(prevFlag = flag);
      xCoordC.push(x);
      yCoordC.push(y);
    }
    // 后续
    else {
      if (x === 0) {
        flag += _glyFlag.default.XSAME;
      } else {
        if (-0xFF <= x && x <= 0xFF) {
          flag += _glyFlag.default.XSHORT;
          if (x > 0) {
            flag += _glyFlag.default.XSAME;
          }
          x = Math.abs(x);
        }
        xCoordC.push(x);
      }
      if (y === 0) {
        flag += _glyFlag.default.YSAME;
      } else {
        if (-0xFF <= y && y <= 0xFF) {
          flag += _glyFlag.default.YSHORT;
          if (y > 0) {
            flag += _glyFlag.default.YSAME;
          }
          y = Math.abs(y);
        }
        yCoordC.push(y);
      }

      // repeat
      if (flag === prevFlag) {
        // 记录重复个数
        if (-1 === repeatPoint) {
          repeatPoint = flagsC.length - 1;
          flagsC[repeatPoint] |= _glyFlag.default.REPEAT;
          flagsC.push(1);
        } else {
          ++flagsC[repeatPoint + 1];
        }
      } else {
        repeatPoint = -1;
        flagsC.push(prevFlag = flag);
      }
    }
  });
  glyfSupport.flags = flagsC;
  glyfSupport.xCoord = xCoordC;
  glyfSupport.yCoord = yCoordC;
  return glyfSupport;
}

/**
 * 对glyf数据进行预处理，获取大小
 *
 * @param  {Object} ttf ttf对象
 * @return {number} 大小
 */
function sizeof(ttf) {
  ttf.support.glyf = [];
  var tableSize = 0;
  var hinting = ttf.writeOptions ? ttf.writeOptions.hinting : false;
  var writeZeroContoursGlyfData = ttf.writeOptions ? ttf.writeOptions.writeZeroContoursGlyfData : false;
  ttf.glyf.forEach(function (glyf) {
    var glyfSupport = {};
    glyfSupport = glyf.compound ? glyfSupport : getFlags(glyf, glyfSupport);
    var glyfSize = glyf.compound ? sizeofCompound(glyf, hinting) : sizeofSimple(glyf, glyfSupport, hinting, writeZeroContoursGlyfData);
    var size = glyfSize;

    // 4字节对齐
    if (size % 4) {
      size += 4 - size % 4;
    }
    glyfSupport.glyfSize = glyfSize;
    glyfSupport.size = size;
    ttf.support.glyf.push(glyfSupport);
    tableSize += size;
  });
  ttf.support.glyf.tableSize = tableSize;

  // 写header的indexToLocFormat
  ttf.head.indexToLocFormat = tableSize > 65536 ? 1 : 0;
  return ttf.support.glyf.tableSize;
}
},
"ttf/table/name.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _nameId = _interopRequireDefault(__load("ttf/enum/nameId.js"));
var _string = _interopRequireDefault(__load("ttf/util/string.js"));
var _platform = _interopRequireDefault(__load("ttf/enum/platform.js"));
var _encoding = __load("ttf/enum/encoding.js");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file name表
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = _table.default.create('name', [], {
  read: function read(reader) {
    var offset = this.offset;
    reader.seek(offset);
    var nameTbl = {};
    nameTbl.format = reader.readUint16();
    nameTbl.count = reader.readUint16();
    nameTbl.stringOffset = reader.readUint16();
    var nameRecordTbl = [];
    var count = nameTbl.count;
    var i;
    var nameRecord;
    for (i = 0; i < count; ++i) {
      nameRecord = {};
      nameRecord.platform = reader.readUint16();
      nameRecord.encoding = reader.readUint16();
      nameRecord.language = reader.readUint16();
      nameRecord.nameId = reader.readUint16();
      nameRecord.length = reader.readUint16();
      nameRecord.offset = reader.readUint16();
      nameRecordTbl.push(nameRecord);
    }
    offset += nameTbl.stringOffset;

    // 读取字符名字
    for (i = 0; i < count; ++i) {
      nameRecord = nameRecordTbl[i];
      nameRecord.name = reader.readBytes(offset + nameRecord.offset, nameRecord.length);
    }
    var names = {};

    // mac 下的english name
    var platform = _platform.default.Macintosh;
    var encoding = _encoding.mac.Default;
    var language = 0;

    // 如果有windows 下的 english，则用windows下的 name
    if (nameRecordTbl.some(function (record) {
      return record.platform === _platform.default.Microsoft && record.encoding === _encoding.win.UCS2 && record.language === 1033;
    })) {
      platform = _platform.default.Microsoft;
      encoding = _encoding.win.UCS2;
      language = 1033;
    }
    for (i = 0; i < count; ++i) {
      nameRecord = nameRecordTbl[i];
      if (nameRecord.platform === platform && nameRecord.encoding === encoding && nameRecord.language === language && _nameId.default[nameRecord.nameId]) {
        names[_nameId.default[nameRecord.nameId]] = language === 0 ? _string.default.getUTF8String(nameRecord.name) : _string.default.getUCS2String(nameRecord.name);
      }
    }
    return names;
  },
  write: function write(writer, ttf) {
    var nameRecordTbl = ttf.support.name;
    writer.writeUint16(0); // format
    writer.writeUint16(nameRecordTbl.length); // count
    writer.writeUint16(6 + nameRecordTbl.length * 12); // string offset

    // write name tbl header
    var offset = 0;
    nameRecordTbl.forEach(function (nameRecord) {
      writer.writeUint16(nameRecord.platform);
      writer.writeUint16(nameRecord.encoding);
      writer.writeUint16(nameRecord.language);
      writer.writeUint16(nameRecord.nameId);
      writer.writeUint16(nameRecord.name.length);
      writer.writeUint16(offset); // offset
      offset += nameRecord.name.length;
    });

    // write name tbl strings
    nameRecordTbl.forEach(function (nameRecord) {
      writer.writeBytes(nameRecord.name);
    });
    return writer;
  },
  size: function size(ttf) {
    var names = ttf.name;
    var nameRecordTbl = [];

    // 写入name信息
    // 这里为了简化书写，仅支持英文编码字符，
    // 中文编码字符将被转化成url encode
    var size = 6;
    Object.keys(names).forEach(function (name) {
      var id = _nameId.default.names[name];
      var utf8Bytes = _string.default.toUTF8Bytes(names[name]);
      var usc2Bytes = _string.default.toUCS2Bytes(names[name]);
      if (undefined !== id) {
        // mac
        nameRecordTbl.push({
          nameId: id,
          platform: 1,
          encoding: 0,
          language: 0,
          name: utf8Bytes
        });

        // windows
        nameRecordTbl.push({
          nameId: id,
          platform: 3,
          encoding: 1,
          language: 1033,
          name: usc2Bytes
        });

        // 子表大小
        size += 12 * 2 + utf8Bytes.length + usc2Bytes.length;
      }
    });
    var namingOrder = ['platform', 'encoding', 'language', 'nameId'];
    nameRecordTbl = nameRecordTbl.sort(function (a, b) {
      var l = 0;
      namingOrder.some(function (name) {
        var o = a[name] - b[name];
        if (o) {
          l = o;
          return true;
        }
        return false;
      });
      return l;
    });

    // 保存预处理信息
    ttf.support.name = nameRecordTbl;
    return size;
  }
});
},
"ttf/enum/nameId.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file ttf `name`编码表
 * @author mengke01(kekee000@gmail.com)
 */

var nameId = {
  0: 'copyright',
  1: 'fontFamily',
  2: 'fontSubFamily',
  3: 'uniqueSubFamily',
  4: 'fullName',
  5: 'version',
  6: 'postScriptName',
  7: 'tradeMark',
  8: 'manufacturer',
  9: 'designer',
  10: 'description',
  11: 'urlOfFontVendor',
  12: 'urlOfFontDesigner',
  13: 'licence',
  14: 'urlOfLicence',
  16: 'preferredFamily',
  17: 'preferredSubFamily',
  18: 'compatibleFull',
  19: 'sampleText'
};

// 反转names
var nameIdHash = {};
Object.keys(nameId).forEach(function (id) {
  nameIdHash[nameId[id]] = +id;
});
nameId.names = nameIdHash;
var _default = exports.default = nameId;
},
"ttf/util/string.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _unicodeName = _interopRequireDefault(__load("ttf/enum/unicodeName.js"));
var _postName = _interopRequireDefault(__load("ttf/enum/postName.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file ttf字符串相关函数
 * @author mengke01(kekee000@gmail.com)
 *
 * references:
 * 1. svg2ttf @ github
 */

/**
 * 将unicode编码转换成js内部编码，
 * 有时候单子节的字符会编码成类似`\u0020`, 这里还原单字节
 *
 * @param {string} str str字符串
 * @return {string} 转换后字符串
 */
function stringify(str) {
  if (!str) {
    return str;
  }
  var newStr = '';
  for (var i = 0, l = str.length, ch; i < l; i++) {
    ch = str.charCodeAt(i);
    if (ch === 0) {
      continue;
    }
    newStr += String.fromCharCode(ch);
  }
  return newStr;
}
var _default = exports.default = {
  stringify: stringify,
  /**
   * 将双字节编码字符转换成`\uxxxx`形式
   *
   * @param {string} str str字符串
   * @return {string} 转换后字符串
   */
  escape: function (_escape) {
    function escape(_x) {
      return _escape.apply(this, arguments);
    }
    escape.toString = function () {
      return _escape.toString();
    };
    return escape;
  }(function (str) {
    if (!str) {
      return str;
    }
    return String(str).replace(/[\uff-\uffff]/g, function (c) {
      return escape(c).replace('%', '\\');
    });
  }),
  /**
   * bytes to string
   *
   * @param  {Array} bytes 字节数组
   * @return {string}       string
   */
  getString: function getString(bytes) {
    var s = '';
    for (var i = 0, l = bytes.length; i < l; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    return s;
  },
  /**
   * 获取unicode的名字值
   *
   * @param {number} unicode unicode
   * @return {string} 名字
   */
  getUnicodeName: function getUnicodeName(unicode) {
    var unicodeNameIndex = _unicodeName.default[unicode];
    if (undefined !== unicodeNameIndex) {
      return _postName.default[unicodeNameIndex];
    }
    return 'uni' + unicode.toString(16).toUpperCase();
  },
  /**
   * 转换成utf8的字节数组
   *
   * @param {string} str 字符串
   * @return {Array.<byte>} 字节数组
   */
  toUTF8Bytes: function toUTF8Bytes(str) {
    str = stringify(str);
    var byteArray = [];
    for (var i = 0, l = str.length; i < l; i++) {
      if (str.charCodeAt(i) <= 0x7F) {
        byteArray.push(str.charCodeAt(i));
      } else {
        var codePoint = str.codePointAt(i);
        if (codePoint > 0xffff) {
          i++;
        }
        var h = encodeURIComponent(String.fromCodePoint(codePoint)).slice(1).split('%');
        for (var j = 0; j < h.length; j++) {
          byteArray.push(parseInt(h[j], 16));
        }
      }
    }
    return byteArray;
  },
  /**
   * 转换成usc2的字节数组
   *
   * @param {string} str 字符串
   * @return {Array.<byte>} 字节数组
   */
  toUCS2Bytes: function toUCS2Bytes(str) {
    str = stringify(str);
    var byteArray = [];
    for (var i = 0, l = str.length, ch; i < l; i++) {
      ch = str.charCodeAt(i);
      byteArray.push(ch >> 8);
      byteArray.push(ch & 0xFF);
    }
    return byteArray;
  },
  /**
   * 获取pascal string 字节数组
   *
   * @param {string} str 字符串
   * @return {Array.<byte>} byteArray byte数组
   */
  toPascalStringBytes: function toPascalStringBytes(str) {
    var bytes = [];
    var length = str ? str.length < 256 ? str.length : 255 : 0;
    bytes.push(length);
    for (var i = 0, l = str.length; i < l; i++) {
      var c = str.charCodeAt(i);
      // non-ASCII characters are substituted with '*'
      bytes.push(c < 128 ? c : 42);
    }
    return bytes;
  },
  /**
   * utf8字节转字符串
   *
   * @param {Array} bytes 字节
   * @return {string} 字符串
   */
  getUTF8String: function getUTF8String(bytes) {
    var str = '';
    for (var i = 0, l = bytes.length; i < l; i++) {
      if (bytes[i] < 0x7F) {
        str += String.fromCharCode(bytes[i]);
      } else {
        str += '%' + (256 + bytes[i]).toString(16).slice(1);
      }
    }
    return unescape(str);
  },
  /**
   * ucs2字节转字符串
   *
   * @param {Array} bytes 字节
   * @return {string} 字符串
   */
  getUCS2String: function getUCS2String(bytes) {
    var str = '';
    for (var i = 0, l = bytes.length; i < l; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) + bytes[i + 1]);
    }
    return str;
  },
  /**
   * 读取 pascal string
   *
   * @param {Array.<byte>} byteArray byte数组
   * @return {Array.<string>} 读取后的字符串数组
   */
  getPascalString: function getPascalString(byteArray) {
    var strArray = [];
    var i = 0;
    var l = byteArray.length;
    while (i < l) {
      var strLength = byteArray[i++];
      var str = '';
      while (strLength-- > 0 && i < l) {
        str += String.fromCharCode(byteArray[i++]);
      }
      // 这里需要将unicode转换成js编码
      str = stringify(str);
      strArray.push(str);
    }
    return strArray;
  }
};
},
"ttf/enum/unicodeName.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file unicode 编码与postName对照表
 * @author mengke01(kekee000@gmail.com)
 *
 * see:
 * http://www.microsoft.com/typography/otspec/WGL4.htm
 */
var _default = exports.default = {
  0: 1,
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
  8: 1,
  9: 2,
  10: 1,
  11: 1,
  12: 1,
  13: 2,
  14: 1,
  15: 1,
  16: 1,
  17: 1,
  18: 1,
  19: 1,
  20: 1,
  21: 1,
  22: 1,
  23: 1,
  24: 1,
  25: 1,
  26: 1,
  27: 1,
  28: 1,
  29: 1,
  30: 1,
  31: 1,
  32: 3,
  33: 4,
  34: 5,
  35: 6,
  36: 7,
  37: 8,
  38: 9,
  39: 10,
  40: 11,
  41: 12,
  42: 13,
  43: 14,
  44: 15,
  45: 16,
  46: 17,
  47: 18,
  48: 19,
  49: 20,
  50: 21,
  51: 22,
  52: 23,
  53: 24,
  54: 25,
  55: 26,
  56: 27,
  57: 28,
  58: 29,
  59: 30,
  60: 31,
  61: 32,
  62: 33,
  63: 34,
  64: 35,
  65: 36,
  66: 37,
  67: 38,
  68: 39,
  69: 40,
  70: 41,
  71: 42,
  72: 43,
  73: 44,
  74: 45,
  75: 46,
  76: 47,
  77: 48,
  78: 49,
  79: 50,
  80: 51,
  81: 52,
  82: 53,
  83: 54,
  84: 55,
  85: 56,
  86: 57,
  87: 58,
  88: 59,
  89: 60,
  90: 61,
  91: 62,
  92: 63,
  93: 64,
  94: 65,
  95: 66,
  96: 67,
  97: 68,
  98: 69,
  99: 70,
  100: 71,
  101: 72,
  102: 73,
  103: 74,
  104: 75,
  105: 76,
  106: 77,
  107: 78,
  108: 79,
  109: 80,
  110: 81,
  111: 82,
  112: 83,
  113: 84,
  114: 85,
  115: 86,
  116: 87,
  117: 88,
  118: 89,
  119: 90,
  120: 91,
  121: 92,
  122: 93,
  123: 94,
  124: 95,
  125: 96,
  126: 97,
  160: 172,
  161: 163,
  162: 132,
  163: 133,
  164: 189,
  165: 150,
  166: 232,
  167: 134,
  168: 142,
  169: 139,
  170: 157,
  171: 169,
  172: 164,
  174: 138,
  175: 218,
  176: 131,
  177: 147,
  178: 242,
  179: 243,
  180: 141,
  181: 151,
  182: 136,
  184: 222,
  185: 241,
  186: 158,
  187: 170,
  188: 245,
  189: 244,
  190: 246,
  191: 162,
  192: 173,
  193: 201,
  194: 199,
  195: 174,
  196: 98,
  197: 99,
  198: 144,
  199: 100,
  200: 203,
  201: 101,
  202: 200,
  203: 202,
  204: 207,
  205: 204,
  206: 205,
  207: 206,
  208: 233,
  209: 102,
  210: 211,
  211: 208,
  212: 209,
  213: 175,
  214: 103,
  215: 240,
  216: 145,
  217: 214,
  218: 212,
  219: 213,
  220: 104,
  221: 235,
  222: 237,
  223: 137,
  224: 106,
  225: 105,
  226: 107,
  227: 109,
  228: 108,
  229: 110,
  230: 160,
  231: 111,
  232: 113,
  233: 112,
  234: 114,
  235: 115,
  236: 117,
  237: 116,
  238: 118,
  239: 119,
  240: 234,
  241: 120,
  242: 122,
  243: 121,
  244: 123,
  245: 125,
  246: 124,
  247: 184,
  248: 161,
  249: 127,
  250: 126,
  251: 128,
  252: 129,
  253: 236,
  254: 238,
  255: 186,
  262: 253,
  263: 254,
  268: 255,
  269: 256,
  273: 257,
  286: 248,
  287: 249,
  304: 250,
  305: 215,
  321: 226,
  322: 227,
  338: 176,
  339: 177,
  350: 251,
  351: 252,
  352: 228,
  353: 229,
  376: 187,
  381: 230,
  382: 231,
  402: 166,
  710: 216,
  711: 225,
  728: 219,
  729: 220,
  730: 221,
  731: 224,
  733: 223,
  960: 155,
  8211: 178,
  8212: 179,
  8216: 182,
  8217: 183,
  8218: 196,
  8220: 180,
  8221: 181,
  8222: 197,
  8224: 130,
  8225: 194,
  8226: 135,
  8230: 171,
  8240: 198,
  8249: 190,
  8250: 191,
  8355: 247,
  8482: 140,
  8486: 159,
  8706: 152,
  8710: 168,
  8719: 154,
  8721: 153,
  8722: 239,
  8725: 188,
  8729: 195,
  8730: 165,
  8734: 146,
  8747: 156,
  8776: 167,
  8800: 143,
  8804: 148,
  8805: 149,
  9674: 185,
  61441: 192,
  61442: 193,
  64257: 192,
  64258: 193,
  65535: 0 // 0xFFFF指向.notdef
};
},
"ttf/enum/postName.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file Mac glyf命名表
 * @author mengke01(kekee000@gmail.com)
 *
 * see:
 * http://www.microsoft.com/typography/otspec/WGL4.htm
 */
var _default = exports.default = {
  0: '.notdef',
  1: '.null',
  2: 'nonmarkingreturn',
  3: 'space',
  4: 'exclam',
  5: 'quotedbl',
  6: 'numbersign',
  7: 'dollar',
  8: 'percent',
  9: 'ampersand',
  10: 'quotesingle',
  11: 'parenleft',
  12: 'parenright',
  13: 'asterisk',
  14: 'plus',
  15: 'comma',
  16: 'hyphen',
  17: 'period',
  18: 'slash',
  19: 'zero',
  20: 'one',
  21: 'two',
  22: 'three',
  23: 'four',
  24: 'five',
  25: 'six',
  26: 'seven',
  27: 'eight',
  28: 'nine',
  29: 'colon',
  30: 'semicolon',
  31: 'less',
  32: 'equal',
  33: 'greater',
  34: 'question',
  35: 'at',
  36: 'A',
  37: 'B',
  38: 'C',
  39: 'D',
  40: 'E',
  41: 'F',
  42: 'G',
  43: 'H',
  44: 'I',
  45: 'J',
  46: 'K',
  47: 'L',
  48: 'M',
  49: 'N',
  50: 'O',
  51: 'P',
  52: 'Q',
  53: 'R',
  54: 'S',
  55: 'T',
  56: 'U',
  57: 'V',
  58: 'W',
  59: 'X',
  60: 'Y',
  61: 'Z',
  62: 'bracketleft',
  63: 'backslash',
  64: 'bracketright',
  65: 'asciicircum',
  66: 'underscore',
  67: 'grave',
  68: 'a',
  69: 'b',
  70: 'c',
  71: 'd',
  72: 'e',
  73: 'f',
  74: 'g',
  75: 'h',
  76: 'i',
  77: 'j',
  78: 'k',
  79: 'l',
  80: 'm',
  81: 'n',
  82: 'o',
  83: 'p',
  84: 'q',
  85: 'r',
  86: 's',
  87: 't',
  88: 'u',
  89: 'v',
  90: 'w',
  91: 'x',
  92: 'y',
  93: 'z',
  94: 'braceleft',
  95: 'bar',
  96: 'braceright',
  97: 'asciitilde',
  98: 'Adieresis',
  99: 'Aring',
  100: 'Ccedilla',
  101: 'Eacute',
  102: 'Ntilde',
  103: 'Odieresis',
  104: 'Udieresis',
  105: 'aacute',
  106: 'agrave',
  107: 'acircumflex',
  108: 'adieresis',
  109: 'atilde',
  110: 'aring',
  111: 'ccedilla',
  112: 'eacute',
  113: 'egrave',
  114: 'ecircumflex',
  115: 'edieresis',
  116: 'iacute',
  117: 'igrave',
  118: 'icircumflex',
  119: 'idieresis',
  120: 'ntilde',
  121: 'oacute',
  122: 'ograve',
  123: 'ocircumflex',
  124: 'odieresis',
  125: 'otilde',
  126: 'uacute',
  127: 'ugrave',
  128: 'ucircumflex',
  129: 'udieresis',
  130: 'dagger',
  131: 'degree',
  132: 'cent',
  133: 'sterling',
  134: 'section',
  135: 'bullet',
  136: 'paragraph',
  137: 'germandbls',
  138: 'registered',
  139: 'copyright',
  140: 'trademark',
  141: 'acute',
  142: 'dieresis',
  143: 'notequal',
  144: 'AE',
  145: 'Oslash',
  146: 'infinity',
  147: 'plusminus',
  148: 'lessequal',
  149: 'greaterequal',
  150: 'yen',
  151: 'mu',
  152: 'partialdiff',
  153: 'summation',
  154: 'product',
  155: 'pi',
  156: 'integral',
  157: 'ordfeminine',
  158: 'ordmasculine',
  159: 'Omega',
  160: 'ae',
  161: 'oslash',
  162: 'questiondown',
  163: 'exclamdown',
  164: 'logicalnot',
  165: 'radical',
  166: 'florin',
  167: 'approxequal',
  168: 'Delta',
  169: 'guillemotleft',
  170: 'guillemotright',
  171: 'ellipsis',
  172: 'nonbreakingspace',
  173: 'Agrave',
  174: 'Atilde',
  175: 'Otilde',
  176: 'OE',
  177: 'oe',
  178: 'endash',
  179: 'emdash',
  180: 'quotedblleft',
  181: 'quotedblright',
  182: 'quoteleft',
  183: 'quoteright',
  184: 'divide',
  185: 'lozenge',
  186: 'ydieresis',
  187: 'Ydieresis',
  188: 'fraction',
  189: 'currency',
  190: 'guilsinglleft',
  191: 'guilsinglright',
  192: 'fi',
  193: 'fl',
  194: 'daggerdbl',
  195: 'periodcentered',
  196: 'quotesinglbase',
  197: 'quotedblbase',
  198: 'perthousand',
  199: 'Acircumflex',
  200: 'Ecircumflex',
  201: 'Aacute',
  202: 'Edieresis',
  203: 'Egrave',
  204: 'Iacute',
  205: 'Icircumflex',
  206: 'Idieresis',
  207: 'Igrave',
  208: 'Oacute',
  209: 'Ocircumflex',
  210: 'apple',
  211: 'Ograve',
  212: 'Uacute',
  213: 'Ucircumflex',
  214: 'Ugrave',
  215: 'dotlessi',
  216: 'circumflex',
  217: 'tilde',
  218: 'macron',
  219: 'breve',
  220: 'dotaccent',
  221: 'ring',
  222: 'cedilla',
  223: 'hungarumlaut',
  224: 'ogonek',
  225: 'caron',
  226: 'Lslash',
  227: 'lslash',
  228: 'Scaron',
  229: 'scaron',
  230: 'Zcaron',
  231: 'zcaron',
  232: 'brokenbar',
  233: 'Eth',
  234: 'eth',
  235: 'Yacute',
  236: 'yacute',
  237: 'Thorn',
  238: 'thorn',
  239: 'minus',
  240: 'multiply',
  241: 'onesuperior',
  242: 'twosuperior',
  243: 'threesuperior',
  244: 'onehalf',
  245: 'onequarter',
  246: 'threequarters',
  247: 'franc',
  248: 'Gbreve',
  249: 'gbreve',
  250: 'Idotaccent',
  251: 'Scedilla',
  252: 'scedilla',
  253: 'Cacute',
  254: 'cacute',
  255: 'Ccaron',
  256: 'ccaron',
  257: 'dcroat'
};
},
"ttf/enum/platform.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file 字体所属平台
 * @author mengke01(kekee000@gmail.com)
 */
var _default = exports.default = {
  Unicode: 0,
  Macintosh: 1,
  // mac
  reserved: 2,
  Microsoft: 3 // win
};
},
"ttf/enum/encoding.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.win = exports.mac = void 0;
/**
 * @file Unicode Platform-specific Encoding Identifiers
 * @author mengke01(kekee000@gmail.com)
 */
// mac encoding id
var mac = exports.mac = {
  'Default': 0,
  // default use
  'Version1.1': 1,
  'ISO10646': 2,
  'UnicodeBMP': 3,
  'UnicodenonBMP': 4,
  'UnicodeVariationSequences': 5,
  'FullUnicodecoverage': 6
};

// windows encoding id
var win = exports.win = {
  Symbol: 0,
  UCS2: 1,
  // default use
  ShiftJIS: 2,
  PRC: 3,
  BigFive: 4,
  Johab: 5,
  UCS4: 6
};
},
"ttf/table/hhea.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file hhea 表
 * @author mengke01(kekee000@gmail.com)
 *
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6hhea.html
 */
var _default = exports.default = _table.default.create('hhea', [['version', _struct.default.Fixed], ['ascent', _struct.default.Int16], ['descent', _struct.default.Int16], ['lineGap', _struct.default.Int16], ['advanceWidthMax', _struct.default.Uint16], ['minLeftSideBearing', _struct.default.Int16], ['minRightSideBearing', _struct.default.Int16], ['xMaxExtent', _struct.default.Int16], ['caretSlopeRise', _struct.default.Int16], ['caretSlopeRun', _struct.default.Int16], ['caretOffset', _struct.default.Int16], ['reserved0', _struct.default.Int16], ['reserved1', _struct.default.Int16], ['reserved2', _struct.default.Int16], ['reserved3', _struct.default.Int16], ['metricDataFormat', _struct.default.Int16], ['numOfLongHorMetrics', _struct.default.Uint16]]);
},
"ttf/table/hmtx.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file hmtx 表
 * @author mengke01(kekee000@gmail.com)
 *
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6hmtx.html
 */
var _default = exports.default = _table.default.create('hmtx', [], {
  read: function read(reader, ttf) {
    var offset = this.offset;
    reader.seek(offset);
    var numOfLongHorMetrics = ttf.hhea.numOfLongHorMetrics;
    var hMetrics = [];
    var i;
    var hMetric;
    for (i = 0; i < numOfLongHorMetrics; ++i) {
      hMetric = {};
      hMetric.advanceWidth = reader.readUint16();
      hMetric.leftSideBearing = reader.readInt16();
      hMetrics.push(hMetric);
    }

    // 最后一个宽度
    var advanceWidth = hMetrics[numOfLongHorMetrics - 1].advanceWidth;
    var numOfLast = ttf.maxp.numGlyphs - numOfLongHorMetrics;

    // 获取后续的hmetrics
    for (i = 0; i < numOfLast; ++i) {
      hMetric = {};
      hMetric.advanceWidth = advanceWidth;
      hMetric.leftSideBearing = reader.readInt16();
      hMetrics.push(hMetric);
    }
    return hMetrics;
  },
  write: function write(writer, ttf) {
    var i;
    var numOfLongHorMetrics = ttf.hhea.numOfLongHorMetrics;
    for (i = 0; i < numOfLongHorMetrics; ++i) {
      writer.writeUint16(ttf.glyf[i].advanceWidth);
      writer.writeInt16(ttf.glyf[i].leftSideBearing);
    }

    // 最后一个宽度
    var numOfLast = ttf.glyf.length - numOfLongHorMetrics;
    for (i = 0; i < numOfLast; ++i) {
      writer.writeInt16(ttf.glyf[numOfLongHorMetrics + i].leftSideBearing);
    }
    return writer;
  },
  size: function size(ttf) {
    // 计算同最后一个advanceWidth相等的元素个数
    var numOfLast = 0;
    // 最后一个advanceWidth
    var advanceWidth = ttf.glyf[ttf.glyf.length - 1].advanceWidth;
    for (var i = ttf.glyf.length - 2; i >= 0; i--) {
      if (advanceWidth === ttf.glyf[i].advanceWidth) {
        numOfLast++;
      } else {
        break;
      }
    }
    ttf.hhea.numOfLongHorMetrics = ttf.glyf.length - numOfLast;
    return 4 * ttf.hhea.numOfLongHorMetrics + 2 * numOfLast;
  }
});
},
"ttf/table/post.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
var _string = _interopRequireDefault(__load("ttf/util/string.js"));
var _unicodeName = _interopRequireDefault(__load("ttf/enum/unicodeName.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file post 表
 * @author mengke01(kekee000@gmail.com)
 *
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6post.html
 */

var Posthead = _table.default.create('posthead', [['format', _struct.default.Fixed], ['italicAngle', _struct.default.Fixed], ['underlinePosition', _struct.default.Int16], ['underlineThickness', _struct.default.Int16], ['isFixedPitch', _struct.default.Uint32], ['minMemType42', _struct.default.Uint32], ['maxMemType42', _struct.default.Uint32], ['minMemType1', _struct.default.Uint32], ['maxMemType1', _struct.default.Uint32]]);
var _default = exports.default = _table.default.create('post', [], {
  read: function read(reader, ttf) {
    var format = reader.readFixed(this.offset);
    // 读取表头
    var tbl = new Posthead(this.offset).read(reader, ttf);

    // format2
    if (format === 2) {
      var numberOfGlyphs = reader.readUint16();
      var glyphNameIndex = [];
      for (var i = 0; i < numberOfGlyphs; ++i) {
        glyphNameIndex.push(reader.readUint16());
      }
      var pascalStringOffset = reader.offset;
      var pascalStringLength = ttf.tables.post.length - (pascalStringOffset - this.offset);
      var pascalStringBytes = reader.readBytes(reader.offset, pascalStringLength);
      tbl.nameIndex = glyphNameIndex; // 设置glyf名字索引
      tbl.names = _string.default.getPascalString(pascalStringBytes); // glyf名字数组
    }
    // deprecated
    else if (format === 2.5) {
      tbl.format = 3;
    }
    return tbl;
  },
  write: function write(writer, ttf) {
    var post = ttf.post || {
      format: 3
    };

    // write header
    writer.writeFixed(post.format); // format
    writer.writeFixed(post.italicAngle || 0); // italicAngle
    writer.writeInt16(post.underlinePosition || 0); // underlinePosition
    writer.writeInt16(post.underlineThickness || 0); // underlineThickness
    writer.writeUint32(post.isFixedPitch || 0); // isFixedPitch
    writer.writeUint32(post.minMemType42 || 0); // minMemType42
    writer.writeUint32(post.maxMemType42 || 0); // maxMemType42
    writer.writeUint32(post.minMemType1 || 0); // minMemType1
    writer.writeUint32(post.maxMemType1 || 0); // maxMemType1

    // version 3 不设置post信息
    if (post.format === 2) {
      var numberOfGlyphs = ttf.glyf.length;
      writer.writeUint16(numberOfGlyphs); // numberOfGlyphs
      // write glyphNameIndex
      var nameIndex = ttf.support.post.nameIndex;
      for (var i = 0, l = nameIndex.length; i < l; i++) {
        writer.writeUint16(nameIndex[i]);
      }

      // write names
      ttf.support.post.names.forEach(function (name) {
        writer.writeBytes(name);
      });
    }
  },
  size: function size(ttf) {
    var numberOfGlyphs = ttf.glyf.length;
    ttf.post = ttf.post || {};
    ttf.post.format = ttf.post.format || 3;
    ttf.post.maxMemType1 = numberOfGlyphs;

    // version 3 不设置post信息
    if (ttf.post.format === 3 || ttf.post.format === 1) {
      return 32;
    }

    // version 2
    var size = 34 + numberOfGlyphs * 2; // header + numberOfGlyphs + numberOfGlyphs * 2
    var glyphNames = [];
    var nameIndexArr = [];
    var nameIndex = 0;

    // 获取 name的大小
    for (var i = 0; i < numberOfGlyphs; i++) {
      // .notdef
      if (i === 0) {
        nameIndexArr.push(0);
      } else {
        var glyf = ttf.glyf[i];
        var unicode = glyf.unicode ? glyf.unicode[0] : 0;
        var unicodeNameIndex = _unicodeName.default[unicode];
        if (undefined !== unicodeNameIndex) {
          nameIndexArr.push(unicodeNameIndex);
        } else {
          // 这里需要注意，"" 有可能是"\3" length不为0，但是是空字符串
          var name = glyf.name;
          if (!name || name.charCodeAt(0) < 32) {
            nameIndexArr.push(258 + nameIndex++);
            glyphNames.push([0]);
            size++;
          } else {
            nameIndexArr.push(258 + nameIndex++);
            var bytes = _string.default.toPascalStringBytes(name); // pascal string bytes
            glyphNames.push(bytes);
            size += bytes.length;
          }
        }
      }
    }
    ttf.support.post = {
      nameIndex: nameIndexArr,
      names: glyphNames
    };
    return size;
  }
});
},
"ttf/table/OS2.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
var _struct = _interopRequireDefault(__load("ttf/table/struct.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file OS/2表
 * @author mengke01(kekee000@gmail.com)
 *
 * http://www.microsoft.com/typography/otspec/os2.htm
 */
var _default = exports.default = _table.default.create('OS/2', [['version', _struct.default.Uint16], ['xAvgCharWidth', _struct.default.Int16], ['usWeightClass', _struct.default.Uint16], ['usWidthClass', _struct.default.Uint16], ['fsType', _struct.default.Uint16], ['ySubscriptXSize', _struct.default.Uint16], ['ySubscriptYSize', _struct.default.Uint16], ['ySubscriptXOffset', _struct.default.Uint16], ['ySubscriptYOffset', _struct.default.Uint16], ['ySuperscriptXSize', _struct.default.Uint16], ['ySuperscriptYSize', _struct.default.Uint16], ['ySuperscriptXOffset', _struct.default.Uint16], ['ySuperscriptYOffset', _struct.default.Uint16], ['yStrikeoutSize', _struct.default.Uint16], ['yStrikeoutPosition', _struct.default.Uint16], ['sFamilyClass', _struct.default.Uint16],
// Panose
['bFamilyType', _struct.default.Uint8], ['bSerifStyle', _struct.default.Uint8], ['bWeight', _struct.default.Uint8], ['bProportion', _struct.default.Uint8], ['bContrast', _struct.default.Uint8], ['bStrokeVariation', _struct.default.Uint8], ['bArmStyle', _struct.default.Uint8], ['bLetterform', _struct.default.Uint8], ['bMidline', _struct.default.Uint8], ['bXHeight', _struct.default.Uint8],
// unicode range
['ulUnicodeRange1', _struct.default.Uint32], ['ulUnicodeRange2', _struct.default.Uint32], ['ulUnicodeRange3', _struct.default.Uint32], ['ulUnicodeRange4', _struct.default.Uint32],
// char 4
['achVendID', _struct.default.String, 4], ['fsSelection', _struct.default.Uint16], ['usFirstCharIndex', _struct.default.Uint16], ['usLastCharIndex', _struct.default.Uint16], ['sTypoAscender', _struct.default.Int16], ['sTypoDescender', _struct.default.Int16], ['sTypoLineGap', _struct.default.Int16], ['usWinAscent', _struct.default.Uint16], ['usWinDescent', _struct.default.Uint16],
// version 0 above 39

['ulCodePageRange1', _struct.default.Uint32], ['ulCodePageRange2', _struct.default.Uint32],
// version 1 above 41

['sxHeight', _struct.default.Int16], ['sCapHeight', _struct.default.Int16], ['usDefaultChar', _struct.default.Uint16], ['usBreakChar', _struct.default.Uint16], ['usMaxContext', _struct.default.Uint16]
// version 2,3,4 above 46
], {
  read: function read(reader, ttf) {
    var format = reader.readUint16(this.offset);
    var struct = this.struct;

    // format2
    if (format === 0) {
      struct = struct.slice(0, 39);
    } else if (format === 1) {
      struct = struct.slice(0, 41);
    }
    var OS2Head = _table.default.create('os2head', struct);
    var tbl = new OS2Head(this.offset).read(reader, ttf);

    // 补齐其他version的字段
    var os2Fields = {
      ulCodePageRange1: 1,
      ulCodePageRange2: 0,
      sxHeight: 0,
      sCapHeight: 0,
      usDefaultChar: 0,
      usBreakChar: 32,
      usMaxContext: 0
    };
    return Object.assign(os2Fields, tbl);
  },
  size: function size(ttf) {
    // 更新其他表的统计信息
    // header
    var xMin = 16384;
    var yMin = 16384;
    var xMax = -16384;
    var yMax = -16384;

    // hhea
    var advanceWidthMax = -1;
    var minLeftSideBearing = 16384;
    var minRightSideBearing = 16384;
    var xMaxExtent = -16384;

    // os2 count
    var xAvgCharWidth = 0;
    var usFirstCharIndex = 0x10FFFF;
    var usLastCharIndex = -1;

    // maxp
    var maxPoints = 0;
    var maxContours = 0;
    var maxCompositePoints = 0;
    var maxCompositeContours = 0;
    var maxSizeOfInstructions = 0;
    var maxComponentElements = 0;
    var glyfNotEmpty = 0; // 非空glyf
    var hinting = ttf.writeOptions ? ttf.writeOptions.hinting : false;

    // 计算instructions和functiondefs
    if (hinting) {
      if (ttf.cvt) {
        maxSizeOfInstructions = Math.max(maxSizeOfInstructions, ttf.cvt.length);
      }
      if (ttf.prep) {
        maxSizeOfInstructions = Math.max(maxSizeOfInstructions, ttf.prep.length);
      }
      if (ttf.fpgm) {
        maxSizeOfInstructions = Math.max(maxSizeOfInstructions, ttf.fpgm.length);
      }
    }
    ttf.glyf.forEach(function (glyf) {
      // 统计control point信息
      if (glyf.compound) {
        var compositeContours = 0;
        var compositePoints = 0;
        glyf.glyfs.forEach(function (g) {
          var cglyf = ttf.glyf[g.glyphIndex];
          if (!cglyf) {
            return;
          }
          compositeContours += cglyf.contours ? cglyf.contours.length : 0;
          if (cglyf.contours && cglyf.contours.length) {
            cglyf.contours.forEach(function (contour) {
              compositePoints += contour.length;
            });
          }
        });
        maxComponentElements = Math.max(maxComponentElements, glyf.glyfs.length);
        maxCompositePoints = Math.max(maxCompositePoints, compositePoints);
        maxCompositeContours = Math.max(maxCompositeContours, compositeContours);
      }
      // 简单图元
      else if (glyf.contours && glyf.contours.length) {
        maxContours = Math.max(maxContours, glyf.contours.length);
        var points = 0;
        glyf.contours.forEach(function (contour) {
          points += contour.length;
        });
        maxPoints = Math.max(maxPoints, points);
      }
      if (hinting && glyf.instructions) {
        maxSizeOfInstructions = Math.max(maxSizeOfInstructions, glyf.instructions.length);
      }

      // 统计边界信息
      if (null != glyf.xMin && glyf.xMin < xMin) {
        xMin = glyf.xMin;
      }
      if (null != glyf.yMin && glyf.yMin < yMin) {
        yMin = glyf.yMin;
      }
      if (null != glyf.xMax && glyf.xMax > xMax) {
        xMax = glyf.xMax;
      }
      if (null != glyf.yMax && glyf.yMax > yMax) {
        yMax = glyf.yMax;
      }
      advanceWidthMax = Math.max(advanceWidthMax, glyf.advanceWidth);
      minLeftSideBearing = Math.min(minLeftSideBearing, glyf.leftSideBearing);
      if (null != glyf.xMax) {
        minRightSideBearing = Math.min(minRightSideBearing, glyf.advanceWidth - glyf.xMax);
        xMaxExtent = Math.max(xMaxExtent, glyf.xMax);
      }
      if (null != glyf.advanceWidth) {
        xAvgCharWidth += glyf.advanceWidth;
        glyfNotEmpty++;
      }
      var unicodes = glyf.unicode;
      if (typeof glyf.unicode === 'number') {
        unicodes = [glyf.unicode];
      }
      if (Array.isArray(unicodes)) {
        unicodes.forEach(function (unicode) {
          if (unicode !== 0xFFFF) {
            usFirstCharIndex = Math.min(usFirstCharIndex, unicode);
            usLastCharIndex = Math.max(usLastCharIndex, unicode);
          }
        });
      }
    });

    // 重新设置version 4
    ttf['OS/2'].version = 0x4;
    ttf['OS/2'].achVendID = (ttf['OS/2'].achVendID + '    ').slice(0, 4);
    ttf['OS/2'].xAvgCharWidth = xAvgCharWidth / (glyfNotEmpty || 1);
    ttf['OS/2'].ulUnicodeRange2 = 268435456;
    ttf['OS/2'].usFirstCharIndex = usFirstCharIndex;
    ttf['OS/2'].usLastCharIndex = usLastCharIndex;

    // rewrite hhea
    ttf.hhea.version = ttf.hhea.version || 0x1;
    ttf.hhea.advanceWidthMax = advanceWidthMax;
    ttf.hhea.minLeftSideBearing = minLeftSideBearing;
    ttf.hhea.minRightSideBearing = minRightSideBearing;
    ttf.hhea.xMaxExtent = xMaxExtent;

    // rewrite head
    ttf.head.version = ttf.head.version || 0x1;
    ttf.head.lowestRecPPEM = ttf.head.lowestRecPPEM || 0x8;
    ttf.head.xMin = xMin;
    ttf.head.yMin = yMin;
    ttf.head.xMax = xMax;
    ttf.head.yMax = yMax;

    // head rewrite
    if (ttf.support.head) {
      var _ttf$support$head = ttf.support.head,
        _xMin = _ttf$support$head.xMin,
        _yMin = _ttf$support$head.yMin,
        _xMax = _ttf$support$head.xMax,
        _yMax = _ttf$support$head.yMax;
      if (_xMin != null) {
        ttf.head.xMin = _xMin;
      }
      if (_yMin != null) {
        ttf.head.yMin = _yMin;
      }
      if (_xMax != null) {
        ttf.head.xMax = _xMax;
      }
      if (_yMax != null) {
        ttf.head.yMax = _yMax;
      }
    }
    // hhea rewrite
    if (ttf.support.hhea) {
      var _ttf$support$hhea = ttf.support.hhea,
        _advanceWidthMax = _ttf$support$hhea.advanceWidthMax,
        _xMaxExtent = _ttf$support$hhea.xMaxExtent,
        _minLeftSideBearing = _ttf$support$hhea.minLeftSideBearing,
        _minRightSideBearing = _ttf$support$hhea.minRightSideBearing;
      if (_advanceWidthMax != null) {
        ttf.hhea.advanceWidthMax = _advanceWidthMax;
      }
      if (_xMaxExtent != null) {
        ttf.hhea.xMaxExtent = _xMaxExtent;
      }
      if (_minLeftSideBearing != null) {
        ttf.hhea.minLeftSideBearing = _minLeftSideBearing;
      }
      if (_minRightSideBearing != null) {
        ttf.hhea.minRightSideBearing = _minRightSideBearing;
      }
    }
    // 这里根据存储的maxp来设置新的maxp，避免重复计算maxp
    ttf.maxp = ttf.maxp || {};
    ttf.support.maxp = {
      version: 1.0,
      numGlyphs: ttf.glyf.length,
      maxPoints: maxPoints,
      maxContours: maxContours,
      maxCompositePoints: maxCompositePoints,
      maxCompositeContours: maxCompositeContours,
      maxZones: ttf.maxp.maxZones || 0,
      maxTwilightPoints: ttf.maxp.maxTwilightPoints || 0,
      maxStorage: ttf.maxp.maxStorage || 0,
      maxFunctionDefs: ttf.maxp.maxFunctionDefs || 0,
      maxStackElements: ttf.maxp.maxStackElements || 0,
      maxSizeOfInstructions: maxSizeOfInstructions,
      maxComponentElements: maxComponentElements,
      maxComponentDepth: maxComponentElements ? 1 : 0
    };
    return _table.default.size.call(this, ttf);
  }
});
},
"ttf/table/fpgm.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file fpgm 表
 * @author mengke01(kekee000@gmail.com)
 *
 * reference: https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6fpgm.html
 */
var _default = exports.default = _table.default.create('fpgm', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.fpgm.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.fpgm) {
      writer.writeBytes(ttf.fpgm, ttf.fpgm.length);
    }
  },
  size: function size(ttf) {
    return ttf.fpgm ? ttf.fpgm.length : 0;
  }
});
},
"ttf/table/cvt.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file cvt表
 * @author mengke01(kekee000@gmail.com)
 *
 * @reference: https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6cvt.html
 */
var _default = exports.default = _table.default.create('cvt', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.cvt.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.cvt) {
      writer.writeBytes(ttf.cvt, ttf.cvt.length);
    }
  },
  size: function size(ttf) {
    return ttf.cvt ? ttf.cvt.length : 0;
  }
});
},
"ttf/table/prep.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file prep表
 * @author mengke01(kekee000@gmail.com)
 *
 * @reference: http://www.microsoft.com/typography/otspec140/prep.htm
 */
var _default = exports.default = _table.default.create('prep', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.prep.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.prep) {
      writer.writeBytes(ttf.prep, ttf.prep.length);
    }
  },
  size: function size(ttf) {
    return ttf.prep ? ttf.prep.length : 0;
  }
});
},
"ttf/table/gasp.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file gasp 表
 * 对于需要hinting的字号需要这个表，否则会导致错误
 * @author mengke01(kekee000@gmail.com)
 * reference: https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6gasp.html
 */
var _default = exports.default = _table.default.create('gasp', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.gasp.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.gasp) {
      writer.writeBytes(ttf.gasp, ttf.gasp.length);
    }
  },
  size: function size(ttf) {
    return ttf.gasp ? ttf.gasp.length : 0;
  }
});
},
"ttf/table/GPOS.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file GPOS
 * @author fr33z00(https://github.com/fr33z00)
 *
 * @reference: https://learn.microsoft.com/en-us/typography/opentype/spec/gpos
 */
var _default = exports.default = _table.default.create('GPOS', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.GPOS.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.GPOS) {
      writer.writeBytes(ttf.GPOS, ttf.GPOS.length);
    }
  },
  size: function size(ttf) {
    return ttf.GPOS ? ttf.GPOS.length : 0;
  }
});
},
"ttf/table/kern.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file kern
 * @author fr33z00(https://github.com/fr33z00)
 *
 * @reference: https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6kern.html
 */
var _default = exports.default = _table.default.create('kern', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.kern.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.kern) {
      writer.writeBytes(ttf.kern, ttf.kern.length);
    }
  },
  size: function size(ttf) {
    return ttf.kern ? ttf.kern.length : 0;
  }
});
},
"ttf/table/kerx.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _table = _interopRequireDefault(__load("ttf/table/table.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * @file kerx
 * @author mengke01(kekee000@gmail.com)
 *
 * @reference: https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6kerx.html
 */
var _default = exports.default = _table.default.create('kerx', [], {
  read: function read(reader, ttf) {
    var length = ttf.tables.kerx.length;
    return reader.readBytes(this.offset, length);
  },
  write: function write(writer, ttf) {
    if (ttf.kerx) {
      writer.writeBytes(ttf.kerx, ttf.kerx.length);
    }
  },
  size: function size(ttf) {
    return ttf.kerx ? ttf.kerx.length : 0;
  }
});
},
"ttf/util/checkSum.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = checkSum;
/**
 * @file ttf table校验函数
 * @author mengke01(kekee000@gmail.com)
 */

function checkSumArrayBuffer(buffer) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var length = arguments.length > 2 ? arguments[2] : undefined;
  length = length == null ? buffer.byteLength : length;
  if (offset + length > buffer.byteLength) {
    throw new Error('check sum out of bound');
  }
  var nLongs = Math.floor(length / 4);
  var view = new DataView(buffer, offset, length);
  var sum = 0;
  var i = 0;
  while (i < nLongs) {
    sum += view.getUint32(4 * i++, false);
  }
  var leftBytes = length - nLongs * 4;
  if (leftBytes) {
    offset = nLongs * 4;
    while (leftBytes > 0) {
      sum += view.getUint8(offset, false) << leftBytes * 8;
      offset++;
      leftBytes--;
    }
  }
  return sum % 0x100000000;
}
function checkSumArray(buffer) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var length = arguments.length > 2 ? arguments[2] : undefined;
  length = length || buffer.length;
  if (offset + length > buffer.length) {
    throw new Error('check sum out of bound');
  }
  var nLongs = Math.floor(length / 4);
  var sum = 0;
  var i = 0;
  while (i < nLongs) {
    sum += (buffer[i++] << 24) + (buffer[i++] << 16) + (buffer[i++] << 8) + buffer[i++];
  }
  var leftBytes = length - nLongs * 4;
  if (leftBytes) {
    offset = nLongs * 4;
    while (leftBytes > 0) {
      sum += buffer[offset] << leftBytes * 8;
      offset++;
      leftBytes--;
    }
  }
  return sum % 0x100000000;
}

/**
 * table校验
 *
 * @param {ArrayBuffer|Array} buffer 表数据
 * @param {number=} offset 偏移量
 * @param {number=} length 长度
 *
 * @return {number} 校验和
 */
function checkSum(buffer, offset, length) {
  if (buffer instanceof ArrayBuffer) {
    return checkSumArrayBuffer(buffer, offset, length);
  } else if (buffer instanceof Array) {
    return checkSumArray(buffer, offset, length);
  }
  throw new Error('not support checksum buffer type');
}
},
"ttf/data/empty.js":function(module,exports,__load){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/**
 * @file 空的ttf格式json对象
 * @author mengke01(kekee000@gmail.com)
 */
/* eslint-disable  */
var _default = exports.default = {
  "version": 1,
  "numTables": 10,
  "searchRange": 128,
  "entrySelector": 3,
  "rangeShift": 64,
  "head": {
    "version": 1,
    "fontRevision": 1,
    "checkSumAdjustment": 0,
    "magickNumber": 1594834165,
    "flags": 11,
    "unitsPerEm": 1024,
    "created": 1428940800000,
    "modified": 1428940800000,
    "xMin": 34,
    "yMin": 0,
    "xMax": 306,
    "yMax": 682,
    "macStyle": 0,
    "lowestRecPPEM": 8,
    "fontDirectionHint": 2,
    "indexToLocFormat": 0,
    "glyphDataFormat": 0
  },
  "glyf": [{
    "contours": [[{
      "x": 34,
      "y": 0,
      "onCurve": true
    }, {
      "x": 34,
      "y": 682,
      "onCurve": true
    }, {
      "x": 306,
      "y": 682,
      "onCurve": true
    }, {
      "x": 306,
      "y": 0,
      "onCurve": true
    }], [{
      "x": 68,
      "y": 34,
      "onCurve": true
    }, {
      "x": 272,
      "y": 34,
      "onCurve": true
    }, {
      "x": 272,
      "y": 648,
      "onCurve": true
    }, {
      "x": 68,
      "y": 648,
      "onCurve": true
    }]],
    "xMin": 34,
    "yMin": 0,
    "xMax": 306,
    "yMax": 682,
    "advanceWidth": 374,
    "leftSideBearing": 34,
    "name": ".notdef"
  }],
  "cmap": {},
  "name": {
    "fontFamily": "fonteditor",
    "fontSubFamily": "Medium",
    "uniqueSubFamily": "FontEditor 1.0 : fonteditor",
    "version": "Version 1.0 ; FontEditor (v0.0.1)",
    "postScriptName": "fonteditor",
    "fullName": "fonteditor"
  },
  "hhea": {
    "version": 1,
    "ascent": 812,
    "descent": -212,
    "lineGap": 92,
    "advanceWidthMax": 374,
    "minLeftSideBearing": 34,
    "minRightSideBearing": 68,
    "xMaxExtent": 306,
    "caretSlopeRise": 1,
    "caretSlopeRun": 0,
    "caretOffset": 0,
    "reserved0": 0,
    "reserved1": 0,
    "reserved2": 0,
    "reserved3": 0,
    "metricDataFormat": 0,
    "numOfLongHorMetrics": 1
  },
  "post": {
    "italicAngle": 0,
    "postoints": 65411,
    "underlinePosition": 50,
    "underlineThickness": 0,
    "isFixedPitch": 0,
    "minMemType42": 0,
    "maxMemType42": 0,
    "minMemType1": 0,
    "maxMemType1": 1,
    "format": 2
  },
  "maxp": {
    "version": 1.0,
    "numGlyphs": 0,
    "maxPoints": 0,
    "maxContours": 0,
    "maxCompositePoints": 0,
    "maxCompositeContours": 0,
    "maxZones": 0,
    "maxTwilightPoints": 0,
    "maxStorage": 0,
    "maxFunctionDefs": 0,
    "maxStackElements": 0,
    "maxSizeOfInstructions": 0,
    "maxComponentElements": 0,
    "maxComponentDepth": 0
  },
  "OS/2": {
    "version": 4,
    "xAvgCharWidth": 1031,
    "usWeightClass": 400,
    "usWidthClass": 5,
    "fsType": 0,
    "ySubscriptXSize": 665,
    "ySubscriptYSize": 716,
    "ySubscriptXOffset": 0,
    "ySubscriptYOffset": 143,
    "ySuperscriptXSize": 665,
    "ySuperscriptYSize": 716,
    "ySuperscriptXOffset": 0,
    "ySuperscriptYOffset": 491,
    "yStrikeoutSize": 51,
    "yStrikeoutPosition": 265,
    "sFamilyClass": 0,
    "bFamilyType": 2,
    "bSerifStyle": 0,
    "bWeight": 6,
    "bProportion": 3,
    "bContrast": 0,
    "bStrokeVariation": 0,
    "bArmStyle": 0,
    "bLetterform": 0,
    "bMidline": 0,
    "bXHeight": 0,
    "ulUnicodeRange1": 1,
    "ulUnicodeRange2": 268435456,
    "ulUnicodeRange3": 0,
    "ulUnicodeRange4": 0,
    "achVendID": "PfEd",
    "fsSelection": 192,
    "usFirstCharIndex": 65535,
    "usLastCharIndex": -1,
    "sTypoAscender": 812,
    "sTypoDescender": -212,
    "sTypoLineGap": 92,
    "usWinAscent": 812,
    "usWinDescent": 212,
    "ulCodePageRange1": 1,
    "ulCodePageRange2": 0,
    "sxHeight": 792,
    "sCapHeight": 0,
    "usDefaultChar": 0,
    "usBreakChar": 32,
    "usMaxContext": 1
  }
};
}
};const cache={};function __load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__load);return m.exports;}
window.PilcheTtfWriter=__load("ttf/ttfwriter.js").default;window.PilcheEmptyFont=__load("ttf/data/empty.js").default;})();
