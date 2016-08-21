var rlwe = (function () {

// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = typeof window === 'object';
// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = function print(x) {
    process['stdout'].write(x + '\n');
  };
  if (!Module['printErr']) Module['printErr'] = function printErr(x) {
    process['stderr'].write(x + '\n');
  };

  var nodeFS = require('fs');
  var nodePath = require('path');

  Module['read'] = function read(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.log(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  throw 'NO_DYNAMIC_EXECUTION was set, cannot eval';
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [null,null,null,null,null,null,null,null],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 1*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-1)/1] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0),size))|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var __THREW__ = 0; // Used in checking for thrown exceptions.

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    abort('NO_DYNAMIC_EXECUTION was set, cannot eval - ccall/cwrap are not functional');
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  // NO_DYNAMIC_EXECUTION is on, so we can't use the fast version of cwrap.
  // Fall back to returning a bound version of ccall.
  cwrap = function cwrap(ident, returnType, argTypes) {
    return function() {
      Runtime.warnOnce('NO_DYNAMIC_EXECUTION was set, '
                     + 'using slow cwrap implementation');
      return ccall(ident, returnType, argTypes, arguments);
    }
  }
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}
Module["UTF16ToString"] = UTF16ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}
Module["stringToUTF16"] = stringToUTF16;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}
Module["lengthBytesUTF16"] = lengthBytesUTF16;

function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
Module["UTF32ToString"] = UTF32ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}
Module["stringToUTF32"] = stringToUTF32;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}
Module["lengthBytesUTF32"] = lengthBytesUTF32;

function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  var i = 3;
  // params, etc.
  var basicTypes = {
    'v': 'void',
    'b': 'bool',
    'c': 'char',
    's': 'short',
    'i': 'int',
    'l': 'long',
    'f': 'float',
    'd': 'double',
    'w': 'wchar_t',
    'a': 'signed char',
    'h': 'unsigned char',
    't': 'unsigned short',
    'j': 'unsigned int',
    'm': 'unsigned long',
    'x': 'long long',
    'y': 'unsigned long long',
    'z': '...'
  };
  var subs = [];
  var first = true;
  function dump(x) {
    //return;
    if (x) Module.print(x);
    Module.print(func);
    var pre = '';
    for (var a = 0; a < i; a++) pre += ' ';
    Module.print (pre + '^');
  }
  function parseNested() {
    i++;
    if (func[i] === 'K') i++; // ignore const
    var parts = [];
    while (func[i] !== 'E') {
      if (func[i] === 'S') { // substitution
        i++;
        var next = func.indexOf('_', i);
        var num = func.substring(i, next) || 0;
        parts.push(subs[num] || '?');
        i = next+1;
        continue;
      }
      if (func[i] === 'C') { // constructor
        parts.push(parts[parts.length-1]);
        i += 2;
        continue;
      }
      var size = parseInt(func.substr(i));
      var pre = size.toString().length;
      if (!size || !pre) { i--; break; } // counter i++ below us
      var curr = func.substr(i + pre, size);
      parts.push(curr);
      subs.push(curr);
      i += pre + size;
    }
    i++; // skip E
    return parts;
  }
  function parse(rawList, limit, allowVoid) { // main parser
    limit = limit || Infinity;
    var ret = '', list = [];
    function flushList() {
      return '(' + list.join(', ') + ')';
    }
    var name;
    if (func[i] === 'N') {
      // namespaced N-E
      name = parseNested().join('::');
      limit--;
      if (limit === 0) return rawList ? [name] : name;
    } else {
      // not namespaced
      if (func[i] === 'K' || (first && func[i] === 'L')) i++; // ignore const and first 'L'
      var size = parseInt(func.substr(i));
      if (size) {
        var pre = size.toString().length;
        name = func.substr(i + pre, size);
        i += pre + size;
      }
    }
    first = false;
    if (func[i] === 'I') {
      i++;
      var iList = parse(true);
      var iRet = parse(true, 1, true);
      ret += iRet[0] + ' ' + name + '<' + iList.join(', ') + '>';
    } else {
      ret = name;
    }
    paramLoop: while (i < func.length && limit-- > 0) {
      //dump('paramLoop');
      var c = func[i++];
      if (c in basicTypes) {
        list.push(basicTypes[c]);
      } else {
        switch (c) {
          case 'P': list.push(parse(true, 1, true)[0] + '*'); break; // pointer
          case 'R': list.push(parse(true, 1, true)[0] + '&'); break; // reference
          case 'L': { // literal
            i++; // skip basic type
            var end = func.indexOf('E', i);
            var size = end - i;
            list.push(func.substr(i, size));
            i += size + 2; // size + 'EE'
            break;
          }
          case 'A': { // array
            var size = parseInt(func.substr(i));
            i += size.toString().length;
            if (func[i] !== '_') throw '?';
            i++; // skip _
            list.push(parse(true, 1, true)[0] + ' [' + size + ']');
            break;
          }
          case 'E': break paramLoop;
          default: ret += '?' + c; break paramLoop;
        }
      }
    }
    if (!allowVoid && list.length === 1 && list[0] === 'void') list = []; // avoid (void)
    if (rawList) {
      if (ret) {
        list.push(ret + '?');
      }
      return list;
    } else {
      return ret + flushList();
    }
  }
  var parsed = func;
  try {
    // Special-case the entry point, since its name differs from other name mangling.
    if (func == 'Object._main' || func == '_main') {
      return 'main()';
    }
    if (typeof func === 'number') func = Pointer_stringify(func);
    if (func[0] !== '_') return func;
    if (func[1] !== '_') return func; // C function
    if (func[2] !== 'Z') return func;
    switch (func[3]) {
      case 'n': return 'operator new()';
      case 'd': return 'operator delete()';
    }
    parsed = parse();
  } catch(e) {
    parsed += '?';
  }
  if (parsed.indexOf('?') >= 0 && !hasLibcxxabi) {
    Runtime.warnOnce('warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  }
  return parsed;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 52443072;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 104900000;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be compliant with the asm.js spec (and given that TOTAL_STACK=' + TOTAL_STACK + ')');
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');

var buffer;



buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



// === Body ===

var ASM_CONSTS = [function() { { return Module.getRandomValue(); } },
 function() { { if (Module.getRandomValue === undefined) { try { var window_ = "object" === typeof window ? window : self, crypto_ = typeof window_.crypto !== "undefined" ? window_.crypto : window_.msCrypto, randomValuesStandard = function() { var buf = new Uint32Array(1); crypto_.getRandomValues(buf); return buf[0] >>> 0; }; randomValuesStandard(); Module.getRandomValue = randomValuesStandard; } catch (e) { try { var crypto = require('crypto'), randomValueNodeJS = function() { var buf = crypto.randomBytes(4); return (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0; }; randomValueNodeJS(); Module.getRandomValue = randomValueNodeJS; } catch (e) { throw 'No secure random number generator found'; } } } } }];

function _emscripten_asm_const_0(code) {
 return ASM_CONSTS[code]();
}



STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 9536;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([12,0,0,0,18,0,0,0,19,0,0,0,18,0,0,0,18,0,0,0,25,10,0,0,201,42,0,0,1,32,0,0,237,1,0,0,189,26,0,0,180,38,0,0,98,5,0,0,137,40,0,0,16,31,0,0,179,1,0,0,162,39,0,0,41,4,0,0,148,1,0,0,220,29,0,0,183,4,0,0,176,12,0,0,113,43,0,0,157,20,0,0,133,9,0,0,62,14,0,0,171,11,0,0,134,23,0,0,139,38,0,0,106,24,0,0,118,39,0,0,251,37,0,0,234,3,0,0,110,28,0,0,188,16,0,0,33,28,0,0,107,3,0,0,196,14,0,0,71,6,0,0,112,19,0,0,210,31,0,0,106,18,0,0,242,0,0,0,1,6,0,0,120,14,0,0,139,37,0,0,155,19,0,0,33,2,0,0,220,19,0,0,161,41,0,0,21,19,0,0,8,44,0,0,250,11,0,0,230,47,0,0,179,14,0,0,97,42,0,0,96,11,0,0,66,22,0,0,159,46,0,0,253,18,0,0,109,28,0,0,80,38,0,0,236,43,0,0,43,11,0,0,20,28,0,0,43,4,0,0,97,9,0,0,71,46,0,0,134,1,0,0,252,44,0,0,63,33,0,0,249,14,0,0,220,10,0,0,182,27,0,0,31,19,0,0,204,5,0,0,1,9,0,0,178,19,0,0,44,32,0,0,85,10,0,0,195,30,0,0,226,36,0,0,126,8,0,0,237,30,0,0,153,6,0,0,36,13,0,0,217,15,0,0,199,12,0,0,111,42,0,0,46,18,0,0,241,6,0,0,130,41,0,0,52,14,0,0,183,28,0,0,113,37,0,0,86,27,0,0,160,0,0,0,77,12,0,0,85,17,0,0,254,47,0,0,139,39,0,0,75,15,0,0,202,28,0,0,144,47,0,0,208,15,0,0,201,8,0,0,68,11,0,0,129,4,0,0,143,35,0,0,226,26,0,0,78,8,0,0,163,41,0,0,182,13,0,0,212,20,0,0,49,11,0,0,191,38,0,0,104,36,0,0,119,32,0,0,131,37,0,0,82,35,0,0,200,11,0,0,14,47,0,0,73,36,0,0,98,45,0,0,186,27,0,0,64,12,0,0,162,38,0,0,72,13,0,0,130,8,0,0,8,6,0,0,183,21,0,0,164,1,0,0,112,32,0,0,41,19,0,0,220,1,0,0,203,13,0,0,110,36,0,0,32,19,0,0,195,38,0,0,235,11,0,0,19,12,0,0,81,0,0,0,232,3,0,0,224,16,0,0,153,4,0,0,98,31,0,0,49,37,0,0,158,41,0,0,43,45,0,0,254,29,0,0,196,40,0,0,117,47,0,0,198,11,0,0,128,35,0,0,222,19,0,0,46,5,0,0,111,43,0,0,15,9,0,0,70,44,0,0,22,3,0,0,187,10,0,0,19,29,0,0,63,12,0,0,128,14,0,0,38,4,0,0,11,39,0,0,60,29,0,0,32,34,0,0,67,36,0,0,184,10,0,0,206,45,0,0,159,11,0,0,192,37,0,0,181,3,0,0,44,29,0,0,178,37,0,0,98,28,0,0,196,22,0,0,161,25,0,0,18,30,0,0,0,13,0,0,112,25,0,0,71,5,0,0,143,28,0,0,219,31,0,0,104,22,0,0,210,2,0,0,232,42,0,0,203,15,0,0,231,27,0,0,58,42,0,0,1,0,0,0,220,33,0,0,241,9,0,0,176,13,0,0,43,34,0,0,69,43,0,0,110,6,0,0,134,35,0,0,228,22,0,0,223,6,0,0,134,33,0,0,110,14,0,0,198,27,0,0,203,34,0,0,158,46,0,0,122,31,0,0,13,38,0,0,86,37,0,0,92,15,0,0,23,23,0,0,26,19,0,0,53,14,0,0,126,34,0,0,166,21,0,0,112,47,0,0,123,22,0,0,233,29,0,0,221,30,0,0,21,43,0,0,179,46,0,0,135,38,0,0,109,42,0,0,160,6,0,0,212,12,0,0,65,11,0,0,29,28,0,0,41,8,0,0,40,35,0,0,221,7,0,0,217,2,0,0,88,35,0,0,33,46,0,0,26,11,0,0,3,44,0,0,9,0,0,0,98,25,0,0,32,2,0,0,164,9,0,0,83,1,0,0,101,5,0,0,221,9,0,0,176,31,0,0,0,14,0,0,46,27,0,0,125,19,0,0,120,41,0,0,75,31,0,0,254,20,0,0,236,36,0,0,127,47,0,0,2,17,0,0,165,38,0,0,157,30,0,0,224,12,0,0,148,32,0,0,54,28,0,0,149,8,0,0,118,0,0,0,172,9,0,0,135,22,0,0,59,3,0,0,93,33,0,0,72,44,0,0,106,13,0,0,201,13,0,0,92,11,0,0,39,47,0,0,57,9,0,0,51,7,0,0,214,11,0,0,238,31,0,0,3,24,0,0,114,38,0,0,134,32,0,0,64,2,0,0,95,40,0,0,254,39,0,0,244,40,0,0,191,36,0,0,60,46,0,0,20,23,0,0,162,1,0,0,188,14,0,0,91,29,0,0,53,21,0,0,128,29,0,0,244,42,0,0,101,47,0,0,207,10,0,0,129,15,0,0,106,32,0,0,13,25,0,0,24,39,0,0,239,7,0,0,213,20,0,0,48,42,0,0,61,38,0,0,210,41,0,0,54,23,0,0,239,4,0,0,49,0,0,0,27,23,0,0,54,42,0,0,163,46,0,0,25,42,0,0,23,7,0,0,7,21,0,0,130,12,0,0,141,17,0,0,8,27,0,0,248,39,0,0,183,7,0,0,84,33,0,0,109,11,0,0,91,1,0,0,146,18,0,0,66,7,0,0,87,46,0,0,14,35,0,0,79,37,0,0,236,22,0,0,162,37,0,0,103,22,0,0,46,45,0,0,83,47,0,0,100,41,0,0,193,11,0,0,46,24,0,0,218,46,0,0,123,25,0,0,140,2,0,0,178,14,0,0,154,36,0,0,176,15,0,0,237,15,0,0,113,33,0,0,209,15,0,0,102,23,0,0,122,43,0,0,135,43,0,0,180,3,0,0,69,1,0,0,124,5,0,0,80,27,0,0,231,23,0,0,141,32,0,0,177,42,0,0,176,4,0,0,64,20,0,0,251,9,0,0,234,23,0,0,58,6,0,0,87,40,0,0,15,28,0,0,73,23,0,0,132,10,0,0,89,47,0,0,202,16,0,0,1,13,0,0,31,23,0,0,81,17,0,0,7,33,0,0,120,27,0,0,211,6,0,0,51,12,0,0,238,11,0,0,147,26,0,0,150,22,0,0,227,41,0,0,125,36,0,0,199,9,0,0,171,2,0,0,155,9,0,0,72,14,0,0,64,0,0,0,144,16,0,0,242,13,0,0,67,3,0,0,177,23,0,0,206,15,0,0,60,45,0,0,218,42,0,0,78,12,0,0,91,40,0,0,226,16,0,0,30,8,0,0,88,4,0,0,239,15,0,0,223,43,0,0,185,1,0,0,154,3,0,0,26,4,0,0,184,17,0,0,188,26,0,0,237,32,0,0,123,10,0,0,91,43,0,0,234,14,0,0,27,24,0,0,52,33,0,0,110,47,0,0,177,26,0,0,97,17,0,0,141,18,0,0,96,26,0,0,76,29,0,0,142,30,0,0,22,32,0,0,62,27,0,0,29,31,0,0,205,28,0,0,121,8,0,0,10,2,0,0,215,19,0,0,190,12,0,0,76,40,0,0,59,26,0,0,254,4,0,0,217,38,0,0,186,13,0,0,240,43,0,0,7,44,0,0,37,23,0,0,212,1,0,0,148,15,0,0,126,1,0,0,197,46,0,0,219,20,0,0,187,26,0,0,52,24,0,0,131,33,0,0,241,7,0,0,99,32,0,0,130,7,0,0,39,15,0,0,27,43,0,0,205,3,0,0,198,26,0,0,178,42,0,0,86,20,0,0,104,26,0,0,127,12,0,0,56,0,0,0,237,13,0,0,142,2,0,0,166,6,0,0,62,40,0,0,230,22,0,0,9,24,0,0,39,21,0,0,198,33,0,0,113,46,0,0,65,41,0,0,173,28,0,0,8,24,0,0,64,28,0,0,90,18,0,0,140,34,0,0,172,18,0,0,0,40,0,0,48,19,0,0,41,5,0,0,65,47,0,0,136,27,0,0,104,11,0,0,55,12,0,0,73,16,0,0,238,44,0,0,154,13,0,0,15,44,0,0,92,21,0,0,242,22,0,0,92,45,0,0,167,23,0,0,249,34,0,0,52,0,0,0,102,12,0,0,214,42,0,0,51,37,0,0,151,0,0,0,79,8,0,0,117,15,0,0,23,11,0,0,56,38,0,0,239,24,0,0,43,6,0,0,175,1,0,0,83,29,0,0,254,22,0,0,213,11,0,0,39,26,0,0,117,16,0,0,248,1,0,0,164,45,0,0,254,8,0,0,241,33,0,0,66,35,0,0,16,18,0,0,68,24,0,0,92,46,0,0,240,15,0,0,77,24,0,0,239,33,0,0,235,3,0,0,53,34,0,0,241,0,0,0,58,0,0,0,145,19,0,0,93,40,0,0,117,3,0,0,137,24,0,0,110,13,0,0,229,36,0,0,50,44,0,0,141,31,0,0,208,25,0,0,149,13,0,0,142,0,0,0,81,4,0,0,137,34,0,0,87,1,0,0,186,17,0,0,116,7,0,0,184,4,0,0,119,18,0,0,166,27,0,0,183,40,0,0,141,39,0,0,217,26,0,0,53,45,0,0,195,39,0,0,160,1,0,0,46,3,0,0,169,6,0,0,146,9,0,0,252,33,0,0,205,2,0,0,91,36,0,0,93,5,0,0,250,31,0,0,125,9,0,0,72,41,0,0,1,42,0,0,60,28,0,0,63,43,0,0,182,1,0,0,70,34,0,0,105,23,0,0,206,12,0,0,113,16,0,0,221,26,0,0,121,13,0,0,112,4,0,0,124,14,0,0,166,12,0,0,110,11,0,0,34,7,0,0,137,17,0,0,99,12,0,0,88,31,0,0,163,33,0,0,136,7,0,0,208,1,0,0,133,12,0,0,226,34,0,0,168,27,0,0,68,4,0,0,148,42,0,0,237,39,0,0,167,46,0,0,52,17,0,0,166,35,0,0,192,15,0,0,25,29,0,0,239,23,0,0,131,31,0,0,11,42,0,0,125,0,0,0,28,2,0,0,217,34,0,0,126,31,0,0,100,2,0,0,115,31,0,0,197,47,0,0,100,37,0,0,129,35,0,0,2,42,0,0,45,39,0,0,68,0,0,0,53,25,0,0,43,30,0,0,173,18,0,0,60,19,0,0,246,3,0,0,192,1,0,0,102,15,0,0,112,20,0,0,47,5,0,0,234,33,0,0,160,14,0,0,158,28,0,0,240,11,0,0,33,38,0,0,213,22,0,0,212,21,0,0,156,1,0,0,19,28,0,0,135,15,0,0,19,19,0,0,15,12,0,0,54,25,0,0,209,8,0,0,104,30,0,0,44,22,0,0,137,5,0,0,208,32,0,0,190,45,0,0,220,21,0,0,99,23,0,0,215,35,0,0,209,10,0,0,78,23,0,0,212,0,0,0,155,25,0,0,105,43,0,0,132,21,0,0,6,43,0,0,101,4,0,0,252,18,0,0,92,42,0,0,107,4,0,0,171,16,0,0,236,25,0,0,227,8,0,0,100,38,0,0,199,19,0,0,80,16,0,0,181,14,0,0,238,5,0,0,90,34,0,0,212,17,0,0,240,39,0,0,194,22,0,0,206,13,0,0,121,15,0,0,49,16,0,0,37,41,0,0,250,1,0,0,26,43,0,0,105,25,0,0,145,42,0,0,114,10,0,0,93,39,0,0,10,13,0,0,53,35,0,0,183,13,0,0,155,26,0,0,103,43,0,0,216,10,0,0,141,4,0,0,15,10,0,0,177,34,0,0,107,40,0,0,121,1,0,0,226,17,0,0,138,46,0,0,173,41,0,0,120,39,0,0,136,1,0,0,213,40,0,0,169,1,0,0,17,37,0,0,193,0,0,0,183,8,0,0,53,24,0,0,14,4,0,0,102,44,0,0,60,24,0,0,186,31,0,0,78,11,0,0,70,14,0,0,223,42,0,0,49,41,0,0,199,25,0,0,151,9,0,0,175,46,0,0,107,15,0,0,20,0,0,0,138,19,0,0,43,20,0,0,0,18,0,0,242,34,0,0,234,31,0,0,154,39,0,0,242,5,0,0,217,33,0,0,157,40,0,0,16,13,0,0,222,21,0,0,212,42,0,0,165,25,0,0,252,43,0,0,153,7,0,0,33,43,0,0,119,38,0,0,6,28,0,0,75,19,0,0,100,8,0,0,186,24,0,0,119,15,0,0,165,22,0,0,49,19,0,0,200,13,0,0,118,31,0,0,241,14,0,0,210,34,0,0,14,39,0,0,239,16,0,0,192,34,0,0,126,36,0,0,142,15,0,0,24,26,0,0,133,45,0,0,110,30,0,0,217,25,0,0,201,6,0,0,110,2,0,0,245,40,0,0,134,42,0,0,51,24,0,0,188,27,0,0,151,6,0,0,150,1,0,0,111,47,0,0,148,20,0,0,173,36,0,0,18,47,0,0,226,3,0,0,55,30,0,0,88,21,0,0,215,28,0,0,62,18,0,0,0,2,0,0,108,1,0,0,201,38,0,0,212,11,0,0,96,20,0,0,142,21,0,0,202,4,0,0,126,29,0,0,102,31,0,0,131,27,0,0,134,30,0,0,45,43,0,0,201,11,0,0,49,12,0,0,160,29,0,0,40,10,0,0,224,43,0,0,124,26,0,0,53,47,0,0,99,20,0,0,129,5,0,0,128,37,0,0,253,17,0,0,215,31,0,0,77,47,0,0,207,1,0,0,178,34,0,0,116,32,0,0,69,42,0,0,31,36,0,0,193,42,0,0,78,38,0,0,6,8,0,0,59,24,0,0,243,25,0,0,48,12,0,0,217,23,0,0,156,32,0,0,88,33,0,0,7,27,0,0,49,34,0,0,255,42,0,0,13,34,0,0,241,36,0,0,229,7,0,0,100,35,0,0,122,18,0,0,89,15,0,0,87,41,0,0,139,14,0,0,77,3,0,0,144,7,0,0,7,0,0,0,190,19,0,0,82,12,0,0,213,12,0,0,8,17,0,0,221,14,0,0,2,45,0,0,165,8,0,0,57,16,0,0,207,47,0,0,41,47,0,0,150,21,0,0,1,3,0,0,3,16,0,0,104,15,0,0,228,21,0,0,154,21,0,0,16,43,0,0,66,36,0,0,123,8,0,0,152,13,0,0,10,29,0,0,72,33,0,0,160,12,0,0,220,46,0,0,184,37,0,0,126,5,0,0,129,11,0,0,229,20,0,0,39,28,0,0,238,17,0,0,87,45,0,0,45,44,0,0,82,20,0,0,76,3,0,0,170,27,0,0,210,15,0,0,80,31,0,0,108,35,0,0,222,37,0,0,4,33,0,0,88,27,0,0,30,22,0,0,55,2,0,0,125,11,0,0,171,33,0,0,224,14,0,0,123,19,0,0,69,9,0,0,15,20,0,0,63,0,0,0,181,29,0,0,32,13,0,0,63,46,0,0,105,40,0,0,66,2,0,0,9,27,0,0,204,29,0,0,254,1,0,0,10,21,0,0,62,10,0,0,126,30,0,0,71,22,0,0,31,42,0,0,8,36,0,0,115,44,0,0,12,23,0,0,111,18,0,0,18,45,0,0,174,13,0,0,157,22,0,0,135,41,0,0,242,21,0,0,58,3,0,0,179,19,0,0,18,12,0,0,139,42,0,0,223,38,0,0,172,29,0,0,245,8,0,0,96,46,0,0,7,24,0,0,141,13,0,0,91,17,0,0,167,34,0,0,19,6,0,0,10,7,0,0,239,19,0,0,99,7,0,0,199,4,0,0,30,9,0,0,198,30,0,0,54,6,0,0,113,3,0,0,109,1,0,0,135,7,0,0,10,44,0,0,158,17,0,0,180,37,0,0,130,11,0,0,172,26,0,0,0,5,0,0,102,2,0,0,166,42,0,0,233,47,0,0,82,28,0,0,86,26,0,0,76,38,0,0,121,44,0,0,228,8,0,0,43,44,0,0,33,10,0,0,111,3,0,0,219,30,0,0,135,31,0,0,126,13,0,0,83,33,0,0,211,14,0,0,61,35,0,0,144,22,0,0,57,7,0,0,86,30,0,0,52,31,0,0,201,1,0,0,8,0,0,0,18,2,0,0,191,37,0,0,105,30,0,0,247,44,0,0,250,13,0,0,168,29,0,0,92,41,0,0,138,13,0,0,12,35,0,0,29,38,0,0,4,13,0,0,139,0,0,0,254,7,0,0,124,11,0,0,56,42,0,0,116,36,0,0,106,3,0,0,253,8,0,0,18,22,0,0,87,47,0,0,150,0,0,0,136,2,0,0,64,31,0,0,254,38,0,0,200,36,0,0,11,11,0,0,130,9,0,0,234,44,0,0,81,25,0,0,236,47,0,0,26,38,0,0,161,43,0,0,47,46,0,0,251,43,0,0,237,14,0,0,112,41,0,0,113,11,0,0,119,24,0,0,41,18,0,0,176,24,0,0,215,37,0,0,148,40,0,0,246,1,0,0,254,19,0,0,48,33,0,0,82,24,0,0,220,41,0,0,251,32,0,0,200,29,0,0,227,26,0,0,53,36,0,0,216,25,0,0,172,33,0,0,167,20,0,0,176,3,0,0,95,29,0,0,237,23,0,0,90,7,0,0,241,43,0,0,14,40,0,0,34,21,0,0,227,4,0,0,254,6,0,0,155,20,0,0,1,33,0,0,207,40,0,0,17,16,0,0,72,0,0,0,12,11,0,0,0,17,0,0,31,29,0,0,152,10,0,0,40,43,0,0,231,30,0,0,123,13,0,0,254,15,0,0,108,25,0,0,229,11,0,0,186,43,0,0,83,10,0,0,247,6,0,0,43,28,0,0,110,19,0,0,44,30,0,0,83,38,0,0,233,36,0,0,203,11,0,0,98,16,0,0,170,10,0,0,222,26,0,0,181,40,0,0,205,8,0,0,166,17,0,0,235,35,0,0,45,29,0,0,121,43,0,0,213,35,0,0,68,47,0,0,227,6,0,0,161,8,0,0,145,37,0,0,50,20,0,0,97,3,0,0,255,4,0,0,158,6,0,0,7,42,0,0,228,32,0,0,71,17,0,0,59,41,0,0,231,14,0,0,200,22,0,0,187,42,0,0,1,32,0,0,20,46,0,0,77,9,0,0,68,21,0,0,78,46,0,0,241,16,0,0,120,7,0,0,159,42,0,0,100,27,0,0,144,4,0,0,81,35,0,0,74,43,0,0,37,18,0,0,109,46,0,0,216,43,0,0,95,8,0,0,145,28,0,0,186,41,0,0,61,33,0,0,150,44,0,0,224,19,0,0,69,31,0,0,147,19,0,0,23,44,0,0,6,10,0,0,139,8,0,0,151,23,0,0,118,9,0,0,123,24,0,0,86,36,0,0,195,33,0,0,124,38,0,0,8,33,0,0,194,14,0,0,5,3,0,0,123,46,0,0,186,1,0,0,160,38,0,0,214,43,0,0,237,19,0,0,214,36,0,0,21,4,0,0,177,9,0,0,148,19,0,0,4,29,0,0,98,1,0,0,191,25,0,0,161,36,0,0,160,5,0,0,78,33,0,0,27,0,0,0,7,36,0,0,249,3,0,0,236,28,0,0,96,6,0,0,37,28,0,0,224,45,0,0,102,28,0,0,118,10,0,0,137,33,0,0,0,42,0,0,15,47,0,0,151,29,0,0,47,16,0,0,54,34,0,0,37,46,0,0,216,28,0,0,145,15,0,0,93,46,0,0,74,26,0,0,249,41,0,0,127,39,0,0,185,34,0,0,95,9,0,0,193,35,0,0,71,20,0,0,159,2,0,0,184,11,0,0,243,0,0,0,57,36,0,0,175,12,0,0,126,10,0,0,138,15,0,0,153,11,0,0,66,9,0,0,208,36,0,0,45,27,0,0,75,34,0,0,94,6,0,0,179,39,0,0,31,21,0,0,114,12,0,0,128,43,0,0,189,36,0,0,56,39,0,0,49,32,0,0,113,0,0,0,55,19,0,0,182,32,0,0,118,8,0,0,3,0,0,0,172,30,0,0,180,35,0,0,97,47,0,0,171,20,0,0,144,10,0,0,74,19,0,0,205,33,0,0,127,6,0,0,16,41,0,0,211,29,0,0,146,5,0,0,58,35,0,0,40,32,0,0,221,34,0,0,104,41,0,0,20,17,0,0,131,39,0,0,31,11,0,0,62,17,0,0,172,37,0,0,213,15,0,0,79,28,0,0,0,39,0,0,53,42,0,0,226,28,0,0,75,20,0,0,37,37,0,0,185,3,0,0,164,14,0,0,198,44,0,0,122,25,0,0,85,38,0,0,139,47,0,0,108,39,0,0,203,19,0,0,109,15,0,0,33,35,0,0,100,17,0,0,92,9,0,0,255,30,0,0,130,0,0,0,21,11,0,0,3,27,0,0,182,16,0,0,137,6,0,0,132,28,0,0,211,20,0,0,1,34,0,0,81,16,0,0,36,38,0,0,156,42,0,0,174,46,0,0,93,38,0,0,225,45,0,0,159,22,0,0,248,47,0,0,254,3,0,0,231,36,0,0,224,1,0,0,169,12,0,0,40,45,0,0,36,40,0,0,217,12,0,0,216,39,0,0,228,19,0,0,192,36,0,0,45,35,0,0,97,41,0,0,148,5,0,0,122,9,0,0,78,1,0,0,236,4,0,0,36,17,0,0,24,18,0,0,134,25,0,0,145,0,0,0,91,26,0,0,131,13,0,0,204,33,0,0,231,28,0,0,234,24,0,0,165,32,0,0,171,10,0,0,244,9,0,0,135,16,0,0,99,1,0,0,54,13,0,0,59,20,0,0,147,33,0,0,123,14,0,0,34,41,0,0,29,25,0,0,123,12,0,0,147,41,0,0,188,4,0,0,214,13,0,0,81,34,0,0,16,38,0,0,37,14,0,0,0,48,0,0,199,5,0,0,26,20,0,0,54,32,0,0,25,5,0,0,47,45,0,0,153,25,0,0,38,16,0,0,114,19,0,0,186,42,0,0,145,22,0,0,1,35,0,0,239,17,0,0,96,22,0,0,61,25,0,0,159,19,0,0,79,10,0,0,213,18,0,0,76,44,0,0,65,10,0,0,98,36,0,0,51,2,0,0,73,37,0,0,190,11,0,0,225,13,0,0,197,18,0,0,246,8,0,0,219,43,0,0,129,33,0,0,194,35,0,0,238,18,0,0,70,37,0,0,235,44,0,0,187,3,0,0,242,38,0,0,146,4,0,0,211,42,0,0,35,28,0,0,129,12,0,0,59,36,0,0,140,0,0,0,61,7,0,0,3,18,0,0,214,2,0,0,99,6,0,0,208,10,0,0,159,16,0,0,104,43,0,0,33,31,0,0,25,44,0,0,176,47,0,0,238,35,0,0,22,36,0,0,62,9,0,0,225,28,0,0,147,11,0,0,176,43,0,0,115,47,0,0,108,34,0,0,49,22,0,0,116,16,0,0,207,3,0,0,28,11,0,0,147,34,0,0,120,23,0,0,140,44,0,0,164,7,0,0,112,28,0,0,199,47,0,0,16,47,0,0,204,13,0,0,22,44,0,0,18,14,0,0,180,23,0,0,17,32,0,0,165,1,0,0,189,23,0,0,241,29,0,0,191,12,0,0,16,14,0,0,3,39,0,0,93,2,0,0,9,46,0,0,140,31,0,0,218,21,0,0,44,36,0,0,3,25,0,0,174,18,0,0,82,46,0,0,214,41,0,0,18,23,0,0,201,9,0,0,234,36,0,0,140,32,0,0,178,39,0,0,106,47,0,0,206,10,0,0,43,5,0,0,155,35,0,0,205,47,0,0,8,13,0,0,90,24,0,0,165,2,0,0,15,25,0,0,165,26,0,0,242,3,0,0,103,34,0,0,19,3,0,0,184,31,0,0,202,35,0,0,153,36,0,0,121,20,0,0,192,0,0,0,216,42,0,0,209,28,0,0,1,8,0,0,85,29,0,0,117,13,0,0,167,29,0,0,193,19,0,0,249,23,0,0,84,19,0,0,192,6,0,0,144,1,0,0,59,14,0,0,218,26,0,0,248,23,0,0,27,25,0,0,195,7,0,0,91,41,0,0,115,45,0,0,20,34,0,0,201,47,0,0,130,35,0,0,153,21,0,0,171,27,0,0,79,5,0,0,59,21,0,0,52,44,0,0,230,4,0,0,218,32,0,0,127,40,0,0,158,15,0,0,16,40,0,0,126,14,0,0,205,23,0,0,70,21,0,0,38,27,0,0,60,1,0,0,131,46,0,0,109,32,0,0,45,46,0,0,220,24,0,0,250,3,0,0,17,4,0,0,71,34,0,0,40,9,0,0,3,43,0,0,198,21,0,0,181,7,0,0,67,35,0,0,42,28,0,0,247,45,0,0,136,39,0,0,52,19,0,0,228,16,0,0,195,20,0,0,235,15,0,0,115,17,0,0,181,18,0,0,161,21,0,0,116,29,0,0,160,30,0,0,80,21,0,0,147,0,0,0,205,14,0,0,230,23,0,0,23,33,0,0,166,4,0,0,134,37,0,0,20,15,0,0,69,21,0,0,73,30,0,0,231,43,0,0,103,44,0,0,72,46,0,0,34,4,0,0,18,32,0,0,169,43,0,0,227,39,0,0,31,31,0,0,166,7,0,0,179,35,0,0,39,5,0,0,197,2,0,0,51,32,0,0,80,24,0,0,190,44,0,0,15,34,0,0,113,31,0,0,193,47,0,0,185,33,0,0,102,38,0,0,86,45,0,0,58,38,0,0,132,11,0,0,30,6,0,0,107,25,0,0,110,21,0,0,19,36,0,0,206,35,0,0,46,41,0,0,137,20,0,0,250,14,0,0,176,30,0,0,226,24,0,0,0,35,0,0,55,31,0,0,168,0,0,0,125,37,0,0,184,24,0,0,242,19,0,0,170,7,0,0,199,41,0,0,23,24,0,0,6,38,0,0,193,27,0,0,81,43,0,0,80,5,0,0,116,15,0,0,26,24,0,0,177,20,0,0,133,42,0,0,188,46,0,0,77,44,0,0,122,4,0,0,135,4,0,0,155,24,0,0,48,32,0,0,144,14,0,0,20,32,0,0,81,32,0,0,103,11,0,0,79,33,0,0,117,45,0,0,134,22,0,0,39,1,0,0,211,23,0,0,64,36,0,0,157,6,0,0,174,0,0,0,211,2,0,0,154,25,0,0,95,10,0,0,21,25,0,0,178,10,0,0,243,12,0,0,170,1,0,0,191,40,0,0,111,29,0,0,166,46,0,0,148,36,0,0,173,14,0,0,74,40,0,0,9,8,0,0,249,20,0,0,116,30,0,0,127,35,0,0,250,26,0,0,234,40,0,0,232,5,0,0,94,1,0,0,203,5,0,0,230,24,0,0,208,47,0,0,18,43,0,0,203,24,0,0,47,6,0,0,196,9,0,0,209,5,0,0,44,27,0,0,18,40,0,0,233,8,0,0,244,22,0,0,151,15,0,0,128,32,0,0,50,37,0,0,156,0,0,0,13,5,0,0,129,18,0,0,204,26,0,0,166,18,0,0,69,33,0,0,95,46,0,0,237,24,0,0,197,1,0,0,66,11,0,0,13,7,0,0,3,8,0,0,162,7,0,0,193,45,0,0,123,15,0,0,143,9,0,0,254,23,0,0,19,16,0,0,43,36,0,0,206,40,0,0,200,38,0,0,218,0,0,0,165,36,0,0,56,34,0,0,151,34,0,0,70,5,0,0,57,25,0,0,26,33,0,0,198,6,0,0,186,30,0,0,29,15,0,0,250,5,0,0,99,41,0,0,2,43,0,0,160,44,0,0,207,27,0,0,112,10,0,0,96,39,0,0,30,41,0,0,189,0,0,0,44,12,0,0,136,4,0,0,212,18,0,0,22,12,0,0,91,30,0,0,52,39,0,0,76,7,0,0,35,21,0,0,87,37,0,0,159,31,0,0,54,36,0,0,24,11,0,0,174,9,0,0,213,17,0,0,147,28,0,0,214,19,0,0,10,41,0,0,174,37,0,0,71,4,0,0,28,36,0,0,149,22,0,0,3,32,0,0,134,34,0,0,26,17,0,0,217,4,0,0,105,37,0,0,226,18,0,0,1,31,0,0,245,36,0,0,185,47,0,0,240,31,0,0,50,7,0,0,0,15,0,0,102,27,0,0,3,41,0,0,30,43,0,0,223,26,0,0,243,7,0,0,16,4,0,0,167,40,0,0,20,24,0,0,162,18,0,0,81,44,0,0,90,27,0,0,85,14,0,0,41,22,0,0,204,11,0,0,30,21,0,0,57,18,0,0,6,15,0,0,37,6,0,0,175,23,0,0,209,14,0,0,3,28,0,0,11,46,0,0,109,7,0,0,42,10,0,0,81,23,0,0,216,29,0,0,138,23,0,0,144,36,0,0,145,6,0,0,20,33,0,0,6,4,0,0,210,1,0,0,96,4,0,0,231,9,0,0,21,0,0,0,176,22,0,0,23,3,0,0,127,38,0,0,246,36,0,0,57,11,0,0,3,9,0,0,193,16,0,0,121,45,0,0,107,47,0,0,170,0,0,0,239,25,0,0,4,39,0,0,151,44,0,0,141,11,0,0,201,5,0,0,133,36,0,0,3,40,0,0,118,47,0,0,253,34,0,0,228,9,0,0,245,12,0,0,119,34,0,0,165,6,0,0,89,18,0,0,7,34,0,0,10,3,0,0,152,17,0,0,66,10,0,0,239,45,0,0,249,47,0,0,56,46,0,0,205,16,0,0,171,17,0,0,200,40,0,0,113,25,0,0,196,12,0,0,46,33,0,0,174,14,0,0,131,34,0,0,122,16,0,0,38,17,0,0,146,44,0,0,224,37,0,0,214,3,0,0,29,39,0,0,136,3,0,0,181,9,0,0,171,21,0,0,175,19,0,0,24,0,0,0,91,5,0,0,155,45,0,0,1,43,0,0,85,21,0,0,127,36,0,0,77,10,0,0,99,30,0,0,247,3,0,0,122,40,0,0,148,46,0,0,144,44,0,0,203,41,0,0,59,17,0,0,227,38,0,0,58,43,0,0,158,40,0,0,18,28,0,0,247,40,0,0,238,41,0,0,90,13,0,0,166,30,0,0,116,34,0,0,250,23,0,0,161,1,0,0,12,39,0,0,85,18,0,0,34,9,0,0,118,5,0,0,239,35,0,0,78,28,0,0,199,44,0,0,15,26,0,0,122,6,0,0,100,25,0,0,83,34,0,0,239,2,0,0,146,29,0,0,245,24,0,0,142,3,0,0,249,11,0,0,226,5,0,0,186,25,0,0,131,17,0,0,195,37,0,0,247,26,0,0,3,46,0,0,53,18,0,0,248,20,0,0,191,45,0,0,152,7,0,0,194,1,0,0,225,34,0,0,76,18,0,0,194,47,0,0,242,27,0,0,188,38,0,0,134,28,0,0,33,33,0,0,86,14,0,0,132,36,0,0,202,45,0,0,227,25,0,0,169,20,0,0,253,14,0,0,35,10,0,0,149,12,0,0,177,16,0,0,47,32,0,0,87,20,0,0,181,44,0,0,175,27,0,0,212,3,0,0,170,2,0,0,19,30,0,0,218,19,0,0,28,27,0,0,128,36,0,0,131,42,0,0,73,10,0,0,37,1,0,0,97,35,0,0,185,14,0,0,247,18,0,0,105,34,0,0,134,39,0,0,191,11,0,0,241,4,0,0,103,26,0,0,29,26,0,0,153,32,0,0,254,31,0,0,0,45,0,0,107,26,0,0,216,0,0,0,50,0,0,0,200,31,0,0,92,39,0,0,255,2,0,0,36,33,0,0,249,30,0,0,44,35,0,0,175,35,0,0,67,28,0,0,250,47,0,0,113,40,0,0,180,44,0,0,118,33,0,0,170,6,0,0,168,32,0,0,135,29,0,0,157,12,0,0,28,40,0,0,16,11,0,0,244,13,0,0,2,5,0,0,208,13,0,0,250,20,0,0,169,14,0,0,101,15,0,0,40,24,0,0,209,35,0,0,14,22,0,0,198,23,0,0,251,39,0,0,179,9,0,0,64,5,0,0,226,11,0,0,188,5,0,0,141,15,0,0,79,13,0,0,50,46,0,0,180,0,0,0,42,16,0,0,4,30,0,0,129,10,0,0,128,42,0,0,158,27,0,0,204,0,0,0,133,21,0,0,33,4,0,0,217,37,0,0,97,18,0,0,208,35,0,0,56,36,0,0,212,4,0,0,123,17,0,0,126,20,0,0,155,16,0,0,131,18,0,0,55,43,0,0,115,26,0,0,161,27,0,0,45,36,0,0,56,9,0,0,149,46,0,0,1,46,0,0,195,29,0,0,42,19,0,0,169,26,0,0,202,17,0,0,31,44,0,0,239,0,0,0,84,11,0,0,109,27,0,0,146,0,0,0,107,46,0,0,106,41,0,0,69,20,0,0,206,23,0,0,123,5,0,0,12,7,0,0,147,45,0,0,56,41,0,0,40,22,0,0,147,17,0,0,124,2,0,0,233,21,0,0,115,32,0,0,131,11,0,0,65,13,0,0,18,31,0,0,243,8,0,0,47,13,0,0,16,33,0,0,139,16,0,0,57,34,0,0,208,28,0,0,92,25,0,0,138,32,0,0,71,23,0,0,157,39,0,0,182,28,0,0,251,19,0,0,138,9,0,0,224,4,0,0,104,40,0,0,5,4,0,0,92,22,0,0,45,5,0,0,35,26,0,0,241,34,0,0,100,7,0,0,40,14,0,0,15,42,0,0,103,8,0,0,23,16,0,0,15,13,0,0,1,30,0,0,214,27,0,0,119,28,0,0,237,47,0,0,150,32,0,0,82,1,0,0,106,38,0,0,58,22,0,0,208,6,0,0,34,5,0,0,187,33,0,0,179,36,0,0,71,16,0,0,197,23,0,0,155,3,0,0,243,43,0,0,204,23,0,0,74,39,0,0,64,47,0,0,240,10,0,0,88,46,0,0,44,7,0,0,121,46,0,0,137,8,0,0,84,6,0,0,119,1,0,0,31,30,0,0,136,46,0,0,150,7,0,0,80,13,0,0,242,37,0,0,116,43,0,0,41,37,0,0,154,4,0,0,102,21,0,0,74,34,0,0,204,12,0,0,247,34,0,0,164,8,0,0,143,37,0,0,112,5,0,0,152,22,0,0,231,4,0,0,7,46,0,0,220,6,0,0,208,31,0,0,136,32,0,0,51,34,0,0,63,25,0,0,17,8,0,0,45,30,0,0,167,13,0,0,19,42,0,0,76,33,0,0,177,31,0,0,58,28,0,0,157,9,0,0,30,39,0,0,21,22,0,0,86,31,0,0,150,43,0,0,165,5,0,0,5,29,0,0,156,43,0,0,251,4,0,0,125,26,0,0,152,4,0,0,102,22,0,0,45,47,0,0,179,24,0,0,48,37,0,0,42,12,0,0,158,24,0,0,37,26,0,0,67,2,0,0,49,15,0,0,120,42,0,0,213,25,0,0,153,17,0,0,48,39,0,0,203,22,0,0,242,35,0,0,238,28,0,0,122,32,0,0,238,19,0,0,101,46,0,0,45,26,0,0,44,25,0,0,224,9,0,0,17,36,0,0,99,19,0,0,97,33,0,0,23,14,0,0,210,42,0,0,145,27,0,0,155,32,0,0,65,46,0,0,11,44,0,0,197,28,0,0,84,29,0,0,214,17,0,0,204,22,0,0,189,47,0,0,212,8,0,0,255,5,0,0,128,12,0,0,157,10,0,0,60,0,0,0,142,16,0,0,157,45,0,0,131,16,0,0,40,13,0,0,229,45,0,0,132,47,0,0,246,5,0,0,126,16,0,0,18,24,0,0,232,18,0,0,65,32,0,0,91,12,0,0,205,30,0,0,90,1,0,0,20,8,0,0,109,5,0,0,189,43,0,0,89,20,0,0,31,13,0,0,124,35,0,0,49,46,0,0,121,40,0,0,94,14,0,0,169,16,0,0,158,35,0,0,120,30,0,0,223,40,0,0,147,36,0,0,91,35,0,0,133,33,0,0,145,43,0,0,136,34,0,0,36,21,0,0,144,31,0,0,51,35,0,0,152,24,0,0,187,13,0,0,75,46,0,0,194,4,0,0,197,19,0,0,0,6,0,0,185,6,0,0,132,38,0,0,7,16,0,0,164,42,0,0,166,11,0,0,52,45,0,0,5,14,0,0,111,38,0,0,88,41,0,0,211,44,0,0,97,46,0,0,62,8,0,0,204,2,0,0,40,21,0,0,116,8,0,0,74,7,0,0,91,20,0,0,138,29,0,0,73,43,0,0,141,40,0,0,71,30,0,0,170,46,0,0,120,13,0,0,0,8,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,123,32,114,101,116,117,114,110,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,40,41,59,32,125,0,123,32,105,102,32,40,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,61,61,32,117,110,100,101,102,105,110,101,100,41,32,123,32,116,114,121,32,123,32,118,97,114,32,119,105,110,100,111,119,95,32,61,32,34,111,98,106,101,99,116,34,32,61,61,61,32,116,121,112,101,111,102,32,119,105,110,100,111,119,32,63,32,119,105,110,100,111,119,32,58,32,115,101,108,102,44,32,99,114,121,112,116,111,95,32,61,32,116,121,112,101,111,102,32,119,105,110,100,111,119,95,46,99,114,121,112,116,111,32,33,61,61,32,34,117,110,100,101,102,105,110,101,100,34,32,63,32,119,105,110,100,111,119,95,46,99,114,121,112,116,111,32,58,32,119,105,110,100,111,119,95,46,109,115,67,114,121,112,116,111,44,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,32,61,32,102,117,110,99,116,105,111,110,40,41,32,123,32,118,97,114,32,98,117,102,32,61,32,110,101,119,32,85,105,110,116,51,50,65,114,114,97,121,40,49,41,59,32,99,114,121,112,116,111,95,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,115,40,98,117,102,41,59,32,114,101,116,117,114,110,32,98,117,102,91,48,93,32,62,62,62,32,48,59,32,125,59,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,40,41,59,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,59,32,125,32,99,97,116,99,104,32,40,101,41,32,123,32,116,114,121,32,123,32,118,97,114,32,99,114,121,112,116,111,32,61,32,114,101,113,117,105,114,101,40,39,99,114,121,112,116,111,39,41,44,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,32,61,32,102,117,110,99,116,105,111,110,40,41,32,123,32,118,97,114,32,98,117,102,32,61,32,99,114,121,112,116,111,46,114,97,110,100,111,109,66,121,116,101,115,40,52,41,59,32,114,101,116,117,114,110,32,40,98,117,102,91,48,93,32,60,60,32,50,52,32,124,32,98,117,102,91,49,93,32,60,60,32,49,54,32,124,32,98,117,102,91,50,93,32,60,60,32,56,32,124,32,98,117,102,91,51,93,41,32,62,62,62,32,48,59,32,125,59,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,40,41,59,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,59,32,125,32,99,97,116,99,104,32,40,101,41,32,123,32,116,104,114,111,119,32,39,78,111,32,115,101,99,117,114,101,32,114,97,110,100,111,109,32,110,117,109,98,101,114,32,103,101,110,101,114,97,116,111,114,32,102,111,117,110,100,39,59,32,125,32,125,32,125,32,125,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_bitshift64Ashr"] = _bitshift64Ashr;

   
  Module["_i64Subtract"] = _i64Subtract;

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

  var _emscripten_asm_const=true;

  var _emscripten_asm_const_int=true;

  function _abort() {
      Module['abort']();
    }

  
  var PATH=undefined;
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          setTimeout(Browser.mainLoop.runner, value); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (!window['setImmediate']) {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = '__emcc';
          function Browser_setImmediate_messageHandler(event) {
            if (event.source === window && event.data === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          window.addEventListener("message", Browser_setImmediate_messageHandler, true);
          window['setImmediate'] = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            window.postMessage(emscriptenMainLoopMessageId, "*");
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          window['setImmediate'](Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          Module.printErr('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(function() {
          if (typeof arg !== 'undefined') {
            Runtime.dynCall('vi', func, [arg]);
          } else {
            Runtime.dynCall('v', func);
          }
        });
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        var canvas = Module['canvas'];
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas ||
                                document['msPointerLockElement'] === canvas;
        }
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && canvas.requestPointerLock) {
                canvas.requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement'] ||
               document['msFullScreenElement'] || document['msFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'] ||
                                      document['msExitFullscreen'] ||
                                      document['exitFullscreen'] ||
                                      function() {};
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else {
            
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            
            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
          Browser.updateCanvasDimensions(canvas);
        }
  
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
          document.addEventListener('MSFullscreenChange', fullScreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullScreen = canvasContainer['requestFullScreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullScreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullScreen();
        }
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function () {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function () { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll': 
            delta = event.detail;
            break;
          case 'mousewheel': 
            delta = event.wheelDelta;
            break;
          case 'wheel': 
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          
          // check if SDL is available
          if (typeof SDL != "undefined") {
          	Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          	Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
          	// just add the mouse delta to the current absolut mouse position
          	// FIXME: ideally this should be clamped against the canvas size and zero
          	Browser.mouseX += Browser.mouseMovementX;
          	Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
            
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            } 
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        // check if SDL is available   
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available       
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
             document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
             document['fullScreenElement'] || document['fullscreenElement'] ||
             document['msFullScreenElement'] || document['msFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _pthread_self() {
      //FIXME: assumes only a single thread
      return 0;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);


var debug_table_iiiiiiii = ["0", "jsCall_iiiiiiii_0", "jsCall_iiiiiiii_1", "jsCall_iiiiiiii_2", "jsCall_iiiiiiii_3", "jsCall_iiiiiiii_4", "jsCall_iiiiiiii_5", "jsCall_iiiiiiii_6", "jsCall_iiiiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_stream_ietf_ref_xor_ic", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiiii = ["0", "jsCall_iiiiii_0", "jsCall_iiiiii_1", "jsCall_iiiiii_2", "jsCall_iiiiii_3", "jsCall_iiiiii_4", "jsCall_iiiiii_5", "jsCall_iiiiii_6", "jsCall_iiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_stream_ref", "_stream_ietf_ref", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiiiii = ["0", "jsCall_iiiiiii_0", "jsCall_iiiiiii_1", "jsCall_iiiiiii_2", "jsCall_iiiiiii_3", "jsCall_iiiiiii_4", "jsCall_iiiiiii_5", "jsCall_iiiiiii_6", "jsCall_iiiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_rlwejs_streamoutput", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiii = ["0", "jsCall_iiiii_0", "jsCall_iiiii_1", "jsCall_iiiii_2", "jsCall_iiiii_3", "jsCall_iiiii_4", "jsCall_iiiii_5", "jsCall_iiiii_6", "jsCall_iiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_rlwejs_extendableoutput", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiiiiiii = ["0", "jsCall_iiiiiiiii_0", "jsCall_iiiiiiiii_1", "jsCall_iiiiiiiii_2", "jsCall_iiiiiiiii_3", "jsCall_iiiiiiiii_4", "jsCall_iiiiiiiii_5", "jsCall_iiiiiiiii_6", "jsCall_iiiiiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_stream_ref_xor_ic", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iii = ["0", "jsCall_iii_0", "jsCall_iii_1", "jsCall_iii_2", "jsCall_iii_3", "jsCall_iii_4", "jsCall_iii_5", "jsCall_iii_6", "jsCall_iii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_rlwejs_randombytes", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
function nullFunc_iiiiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiiiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  "); abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  try {
    return Module["dynCall_iiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5,a6,a7);
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiii(index,a1,a2,a3,a4,a5) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiii(index,a1,a2,a3,a4) {
    return Runtime.functionPointers[index](a1,a2,a3,a4);
}

function invoke_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  try {
    return Module["dynCall_iiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5,a6,a7,a8);
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iii(index,a1,a2) {
    return Runtime.functionPointers[index](a1,a2);
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "nullFunc_iiiiiiii": nullFunc_iiiiiiii, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_iiiiiii": nullFunc_iiiiiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii, "nullFunc_iii": nullFunc_iii, "invoke_iiiiiiii": invoke_iiiiiiii, "jsCall_iiiiiiii": jsCall_iiiiiiii, "invoke_iiiiii": invoke_iiiiii, "jsCall_iiiiii": jsCall_iiiiii, "invoke_iiiiiii": invoke_iiiiiii, "jsCall_iiiiiii": jsCall_iiiiiii, "invoke_iiiii": invoke_iiiii, "jsCall_iiiii": jsCall_iiiii, "invoke_iiiiiiiii": invoke_iiiiiiiii, "jsCall_iiiiiiiii": jsCall_iiiiiiiii, "invoke_iii": invoke_iii, "jsCall_iii": jsCall_iii, "_sysconf": _sysconf, "_pthread_self": _pthread_self, "_abort": _abort, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_time": _time, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_set_main_loop": _emscripten_set_main_loop, "_emscripten_asm_const_0": _emscripten_asm_const_0, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var nullFunc_iiiiiiii=env.nullFunc_iiiiiiii;
  var nullFunc_iiiiii=env.nullFunc_iiiiii;
  var nullFunc_iiiiiii=env.nullFunc_iiiiiii;
  var nullFunc_iiiii=env.nullFunc_iiiii;
  var nullFunc_iiiiiiiii=env.nullFunc_iiiiiiiii;
  var nullFunc_iii=env.nullFunc_iii;
  var invoke_iiiiiiii=env.invoke_iiiiiiii;
  var jsCall_iiiiiiii=env.jsCall_iiiiiiii;
  var invoke_iiiiii=env.invoke_iiiiii;
  var jsCall_iiiiii=env.jsCall_iiiiii;
  var invoke_iiiiiii=env.invoke_iiiiiii;
  var jsCall_iiiiiii=env.jsCall_iiiiiii;
  var invoke_iiiii=env.invoke_iiiii;
  var jsCall_iiiii=env.jsCall_iiiii;
  var invoke_iiiiiiiii=env.invoke_iiiiiiiii;
  var jsCall_iiiiiiiii=env.jsCall_iiiiiiiii;
  var invoke_iii=env.invoke_iii;
  var jsCall_iii=env.jsCall_iii;
  var _sysconf=env._sysconf;
  var _pthread_self=env._pthread_self;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var _emscripten_asm_const_0=env._emscripten_asm_const_0;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS
function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
if ((STACKTOP|0) >= (STACK_MAX|0)) abort();

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}
function copyTempFloat(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
}
function copyTempDouble(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
  HEAP8[tempDoublePtr+4>>0] = HEAP8[ptr+4>>0];
  HEAP8[tempDoublePtr+5>>0] = HEAP8[ptr+5>>0];
  HEAP8[tempDoublePtr+6>>0] = HEAP8[ptr+6>>0];
  HEAP8[tempDoublePtr+7>>0] = HEAP8[ptr+7>>0];
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _sodium_memzero($pnt,$len) {
 $pnt = $pnt|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $pnt_ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pnt;
 $1 = $len;
 $2 = $0; //@line 89 "libsodium/src/libsodium/sodium/utils.c"
 $pnt_ = $2; //@line 88 "libsodium/src/libsodium/sodium/utils.c"
 $i = 0; //@line 90 "libsodium/src/libsodium/sodium/utils.c"
 while(1) {
  $3 = $i; //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  $4 = $1; //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  $5 = ($3>>>0)<($4>>>0); //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $7 = (($6) + 1)|0; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $i = $7; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $8 = $pnt_; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $9 = (($8) + ($6)|0); //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  HEAP8[$9>>0] = 0; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
 }
 STACKTOP = sp;return; //@line 96 "libsodium/src/libsodium/sodium/utils.c"
}
function _randombytes_random() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = _emscripten_asm_const_0(0)|0; //@line 70 "libsodium/src/libsodium/randombytes/randombytes.c"
 return ($0|0); //@line 70 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _randombytes_stir() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _emscripten_asm_const_0(1); //@line 85 "libsodium/src/libsodium/randombytes/randombytes.c"
 return; //@line 113 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _randombytes_buf($buf,$size) {
 $buf = $buf|0;
 $size = $size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $p = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $buf;
 $1 = $size;
 $2 = $0; //@line 151 "libsodium/src/libsodium/randombytes/randombytes.c"
 $p = $2; //@line 151 "libsodium/src/libsodium/randombytes/randombytes.c"
 $i = 0; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
 while(1) {
  $3 = $i; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $4 = $1; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $5 = ($3>>>0)<($4>>>0); //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  if (!($5)) {
   break;
  }
  $6 = (_randombytes_random()|0); //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $7 = $6&255; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $8 = $i; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $9 = $p; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $10 = (($9) + ($8)|0); //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  HEAP8[$10>>0] = $7; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $11 = $i; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $12 = (($11) + 1)|0; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $i = $12; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
 }
 STACKTOP = sp;return; //@line 158 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _crypto_stream_chacha20($c,$0,$1,$n,$k) {
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp;
 $2 = $c;
 $6 = $3;
 $7 = $6;
 HEAP32[$7>>2] = $0;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = $1;
 $4 = $n;
 $5 = $k;
 $10 = HEAP32[8>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $11 = HEAP32[$10>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $12 = $2; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $13 = $3; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $14 = $13; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $15 = HEAP32[$14>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $16 = (($13) + 4)|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $17 = $16; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $18 = HEAP32[$17>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $19 = $4; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $20 = $5; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $21 = (FUNCTION_TABLE_iiiiii[$11 & 31]($12,$15,$18,$19,$20)|0); //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 STACKTOP = sp;return ($21|0); //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
}
function _stream_ref($c,$0,$1,$n,$k) {
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp;
 $ctx = sp + 8|0;
 $3 = $c;
 $7 = $4;
 $8 = $7;
 HEAP32[$8>>2] = $0;
 $9 = (($7) + 4)|0;
 $10 = $9;
 HEAP32[$10>>2] = $1;
 $5 = $n;
 $6 = $k;
 $11 = $4; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = $11; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = HEAP32[$12>>2]|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = (($11) + 4)|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = $14; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = HEAP32[$15>>2]|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ($13|0)!=(0); //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ($16|0)!=(0); //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $17 | $18; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($19) {
  $20 = $6; //@line 234 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$20); //@line 234 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $5; //@line 235 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ivsetup($ctx,$21,0); //@line 235 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $3; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $4; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $23; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = HEAP32[$24>>2]|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = (($23) + 4)|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $26; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = HEAP32[$27>>2]|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _memset(($22|0),0,($25|0))|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = $3; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = $3; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $4; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $31; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = HEAP32[$32>>2]|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = (($31) + 4)|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$29,$30,$33,$36); //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 238 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $2 = 0; //@line 240 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $2 = 0; //@line 231 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _chacha_keysetup($ctx,$k) {
 $ctx = $ctx|0;
 $k = $k|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ctx;
 $1 = $k;
 $2 = $0; //@line 50 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$2>>2] = 1634760805; //@line 50 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $3 = $0; //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $4 = ((($3)) + 4|0); //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$4>>2] = 857760878; //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $5 = $0; //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $6 = ((($5)) + 8|0); //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$6>>2] = 2036477234; //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $7 = $0; //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 12|0); //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = 1797285236; //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $9 = $1; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = (_load32_le($9)|0); //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = $0; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = ((($11)) + 16|0); //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$12>>2] = $10; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = $1; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = ((($13)) + 4|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = (_load32_le($14)|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = $0; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ((($16)) + 20|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$17>>2] = $15; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $1; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = ((($18)) + 8|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = (_load32_le($19)|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = $0; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = ((($21)) + 24|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$22>>2] = $20; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $1; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = ((($23)) + 12|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = (_load32_le($24)|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = $0; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = ((($26)) + 28|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$27>>2] = $25; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $1; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = ((($28)) + 16|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $30 = (_load32_le($29)|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = $0; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = ((($31)) + 32|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$32>>2] = $30; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = $1; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = ((($33)) + 20|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = (_load32_le($34)|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $36 = $0; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $37 = ((($36)) + 36|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$37>>2] = $35; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $38 = $1; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $39 = ((($38)) + 24|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $40 = (_load32_le($39)|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $41 = $0; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $42 = ((($41)) + 40|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$42>>2] = $40; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $43 = $1; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $44 = ((($43)) + 28|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $45 = (_load32_le($44)|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $46 = $0; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $47 = ((($46)) + 44|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$47>>2] = $45; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 62 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _load32_le($src) {
 $src = $src|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $w = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $src;
 $1 = $0; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $2 = HEAP8[$1>>0]|0; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $2&255; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $3; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $4 = $0; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $5 = ((($4)) + 1|0); //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $6 = HEAP8[$5>>0]|0; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $7 = $6&255; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $8 = $7 << 8; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $9 = $w; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $10 = $9 | $8; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $10; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $11 = $0; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $12 = ((($11)) + 2|0); //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $13 = HEAP8[$12>>0]|0; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $14 = $13&255; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $15 = $14 << 16; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $16 = $w; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $17 = $16 | $15; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $17; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $18 = $0; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $19 = ((($18)) + 3|0); //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $20 = HEAP8[$19>>0]|0; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $21 = $20&255; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $22 = $21 << 24; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $23 = $w; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $24 = $23 | $22; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $24; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $25 = $w; //@line 60 "libsodium/src/libsodium/include/sodium/private/common.h"
 STACKTOP = sp;return ($25|0); //@line 60 "libsodium/src/libsodium/include/sodium/private/common.h"
}
function _chacha_ivsetup($ctx,$iv,$counter) {
 $ctx = $ctx|0;
 $iv = $iv|0;
 $counter = $counter|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ctx;
 $1 = $iv;
 $2 = $counter;
 $3 = $2; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $4 = ($3|0)==(0|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($4) {
  $9 = 0;
 } else {
  $5 = $2; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $6 = (_load32_le($5)|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $6;
 }
 $7 = $0; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 48|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = $9; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = $2; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = ($10|0)==(0|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($11) {
  $17 = 0;
 } else {
  $12 = $2; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $13 = ((($12)) + 4|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $14 = (_load32_le($13)|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = $14;
 }
 $15 = $0; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = ((($15)) + 52|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$16>>2] = $17; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $1; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = (_load32_le($18)|0); //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $0; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = ((($20)) + 56|0); //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$21>>2] = $19; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = $1; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = ((($22)) + 4|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = (_load32_le($23)|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = $0; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ((($25)) + 60|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$26>>2] = $24; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 71 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _chacha_encrypt_bytes($ctx,$m,$c,$0,$1) {
 $ctx = $ctx|0;
 $m = $m|0;
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0;
 var $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0;
 var $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0;
 var $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0;
 var $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0;
 var $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0;
 var $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0;
 var $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0;
 var $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0;
 var $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0;
 var $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0;
 var $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0;
 var $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0;
 var $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0;
 var $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0;
 var $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0;
 var $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0;
 var $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0;
 var $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $ctarget = 0, $i = 0, $j0 = 0, $j1 = 0, $j10 = 0, $j11 = 0, $j12 = 0, $j13 = 0, $j14 = 0, $j15 = 0, $j2 = 0, $j3 = 0, $j4 = 0, $j5 = 0, $j6 = 0;
 var $j7 = 0, $j8 = 0, $j9 = 0, $tmp = 0, $x0 = 0, $x1 = 0, $x10 = 0, $x11 = 0, $x12 = 0, $x13 = 0, $x14 = 0, $x15 = 0, $x2 = 0, $x3 = 0, $x4 = 0, $x5 = 0, $x6 = 0, $x7 = 0, $x8 = 0, $x9 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $tmp = sp + 160|0;
 $2 = $ctx;
 $3 = $m;
 $4 = $c;
 $6 = $5;
 $7 = $6;
 HEAP32[$7>>2] = $0;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = $1;
 $ctarget = 0; //@line 87 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = $5; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = $10; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = HEAP32[$11>>2]|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = (($10) + 4)|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = $13; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = HEAP32[$14>>2]|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = ($12|0)!=(0); //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ($15|0)!=(0); //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $16 | $17; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if (!($18)) {
  STACKTOP = sp;return; //@line 222 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $19 = $5; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $19; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = HEAP32[$20>>2]|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = (($19) + 4)|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $22; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = HEAP32[$23>>2]|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = ($24>>>0)>(63); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ($21>>>0)>(4294967232); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = ($24|0)==(63); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $27 & $26; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = $25 | $28; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($29) {
  _abort(); //@line 95 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  // unreachable; //@line 95 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $30 = $2; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = HEAP32[$30>>2]|0; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j0 = $31; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = $2; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = ((($32)) + 4|0); //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = HEAP32[$33>>2]|0; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j1 = $34; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = $2; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $36 = ((($35)) + 8|0); //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $37 = HEAP32[$36>>2]|0; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j2 = $37; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $38 = $2; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $39 = ((($38)) + 12|0); //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $40 = HEAP32[$39>>2]|0; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j3 = $40; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $41 = $2; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $42 = ((($41)) + 16|0); //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $43 = HEAP32[$42>>2]|0; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j4 = $43; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $44 = $2; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $45 = ((($44)) + 20|0); //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $46 = HEAP32[$45>>2]|0; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j5 = $46; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $47 = $2; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $48 = ((($47)) + 24|0); //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $49 = HEAP32[$48>>2]|0; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j6 = $49; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $50 = $2; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $51 = ((($50)) + 28|0); //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $52 = HEAP32[$51>>2]|0; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j7 = $52; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $53 = $2; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $54 = ((($53)) + 32|0); //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $55 = HEAP32[$54>>2]|0; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j8 = $55; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $56 = $2; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $57 = ((($56)) + 36|0); //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $58 = HEAP32[$57>>2]|0; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j9 = $58; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $59 = $2; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $60 = ((($59)) + 40|0); //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $61 = HEAP32[$60>>2]|0; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j10 = $61; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $62 = $2; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $63 = ((($62)) + 44|0); //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $64 = HEAP32[$63>>2]|0; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j11 = $64; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $65 = $2; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $66 = ((($65)) + 48|0); //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $67 = HEAP32[$66>>2]|0; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j12 = $67; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $68 = $2; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $69 = ((($68)) + 52|0); //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $70 = HEAP32[$69>>2]|0; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j13 = $70; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $71 = $2; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $72 = ((($71)) + 56|0); //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $73 = HEAP32[$72>>2]|0; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j14 = $73; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $74 = $2; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $75 = ((($74)) + 60|0); //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $76 = HEAP32[$75>>2]|0; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j15 = $76; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 while(1) {
  $77 = $5; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $78 = $77; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $79 = HEAP32[$78>>2]|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $80 = (($77) + 4)|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $81 = $80; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $82 = HEAP32[$81>>2]|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $83 = ($82>>>0)<(0); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $84 = ($79>>>0)<(64); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $85 = ($82|0)==(0); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $86 = $85 & $84; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $87 = $83 | $86; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if ($87) {
   dest=$tmp; stop=dest+64|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0)); //@line 116 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $i = 0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   while(1) {
    $88 = $i; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $89 = $5; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $90 = $89; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $91 = HEAP32[$90>>2]|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $92 = (($89) + 4)|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $93 = $92; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $94 = HEAP32[$93>>2]|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $95 = (0)<($94>>>0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $96 = ($88>>>0)<($91>>>0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $97 = (0)==($94|0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $98 = $97 & $96; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $99 = $95 | $98; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    if (!($99)) {
     break;
    }
    $100 = $i; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $101 = $3; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $102 = (($101) + ($100)|0); //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $103 = HEAP8[$102>>0]|0; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $104 = $i; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $105 = (($tmp) + ($104)|0); //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    HEAP8[$105>>0] = $103; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $106 = $i; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $107 = (($106) + 1)|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $i = $107; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   }
   $3 = $tmp; //@line 120 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $108 = $4; //@line 121 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $ctarget = $108; //@line 121 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $4 = $tmp; //@line 122 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $109 = $j0; //@line 124 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x0 = $109; //@line 124 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $110 = $j1; //@line 125 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x1 = $110; //@line 125 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $111 = $j2; //@line 126 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x2 = $111; //@line 126 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $112 = $j3; //@line 127 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x3 = $112; //@line 127 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $113 = $j4; //@line 128 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x4 = $113; //@line 128 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $114 = $j5; //@line 129 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x5 = $114; //@line 129 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $115 = $j6; //@line 130 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x6 = $115; //@line 130 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $116 = $j7; //@line 131 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x7 = $116; //@line 131 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $117 = $j8; //@line 132 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x8 = $117; //@line 132 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $118 = $j9; //@line 133 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x9 = $118; //@line 133 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $119 = $j10; //@line 134 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x10 = $119; //@line 134 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $120 = $j11; //@line 135 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x11 = $120; //@line 135 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $121 = $j12; //@line 136 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x12 = $121; //@line 136 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $122 = $j13; //@line 137 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x13 = $122; //@line 137 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $123 = $j14; //@line 138 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x14 = $123; //@line 138 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $124 = $j15; //@line 139 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x15 = $124; //@line 139 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $i = 20; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  while(1) {
   $125 = $i; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $126 = ($125>>>0)>(0); //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $127 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   if (!($126)) {
    break;
   }
   $128 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $129 = (($127) + ($128))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $129; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $130 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $131 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $132 = $130 ^ $131; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $133 = $132 << 16; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $134 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $135 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $136 = $134 ^ $135; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $137 = $136 >>> 16; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $138 = $133 | $137; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $138; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $139 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $140 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $141 = (($139) + ($140))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $141; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $142 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $143 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $144 = $142 ^ $143; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $145 = $144 << 12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $146 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $147 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $148 = $146 ^ $147; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $149 = $148 >>> 20; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $150 = $145 | $149; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $150; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $151 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $152 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $153 = (($151) + ($152))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $153; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $154 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $155 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $156 = $154 ^ $155; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $157 = $156 << 8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $158 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $159 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $160 = $158 ^ $159; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $161 = $160 >>> 24; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $162 = $157 | $161; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $162; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $163 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $164 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $165 = (($163) + ($164))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $165; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $166 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $167 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $168 = $166 ^ $167; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $169 = $168 << 7; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $170 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $171 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $172 = $170 ^ $171; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $173 = $172 >>> 25; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $174 = $169 | $173; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $174; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $175 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $176 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $177 = (($175) + ($176))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $177; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $178 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $179 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $180 = $178 ^ $179; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $181 = $180 << 16; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $182 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $183 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $184 = $182 ^ $183; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $185 = $184 >>> 16; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $186 = $181 | $185; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $186; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $187 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $188 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $189 = (($187) + ($188))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $189; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $190 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $191 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $192 = $190 ^ $191; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $193 = $192 << 12; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $194 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $195 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $196 = $194 ^ $195; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $197 = $196 >>> 20; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $198 = $193 | $197; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $198; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $199 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $200 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $201 = (($199) + ($200))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $201; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $202 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $203 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $204 = $202 ^ $203; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $205 = $204 << 8; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $206 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $207 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $208 = $206 ^ $207; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $209 = $208 >>> 24; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $210 = $205 | $209; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $210; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $211 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $212 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $213 = (($211) + ($212))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $213; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $214 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $215 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $216 = $214 ^ $215; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $217 = $216 << 7; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $218 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $219 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $220 = $218 ^ $219; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $221 = $220 >>> 25; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $222 = $217 | $221; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $222; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $223 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $224 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $225 = (($223) + ($224))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $225; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $226 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $227 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $228 = $226 ^ $227; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $229 = $228 << 16; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $230 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $231 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $232 = $230 ^ $231; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $233 = $232 >>> 16; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $234 = $229 | $233; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $234; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $235 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $236 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $237 = (($235) + ($236))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $237; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $238 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $239 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $240 = $238 ^ $239; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $241 = $240 << 12; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $242 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $243 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $244 = $242 ^ $243; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $245 = $244 >>> 20; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $246 = $241 | $245; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $246; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $247 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $248 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $249 = (($247) + ($248))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $249; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $250 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $251 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $252 = $250 ^ $251; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $253 = $252 << 8; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $254 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $255 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $256 = $254 ^ $255; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $257 = $256 >>> 24; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $258 = $253 | $257; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $258; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $259 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $260 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $261 = (($259) + ($260))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $261; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $262 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $263 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $264 = $262 ^ $263; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $265 = $264 << 7; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $266 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $267 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $268 = $266 ^ $267; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $269 = $268 >>> 25; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $270 = $265 | $269; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $270; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $271 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $272 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $273 = (($271) + ($272))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $273; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $274 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $275 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $276 = $274 ^ $275; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $277 = $276 << 16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $278 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $279 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $280 = $278 ^ $279; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $281 = $280 >>> 16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $282 = $277 | $281; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $282; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $283 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $284 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $285 = (($283) + ($284))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $285; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $286 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $287 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $288 = $286 ^ $287; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $289 = $288 << 12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $290 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $291 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $292 = $290 ^ $291; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $293 = $292 >>> 20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $294 = $289 | $293; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $294; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $295 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $296 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $297 = (($295) + ($296))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $297; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $298 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $299 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $300 = $298 ^ $299; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $301 = $300 << 8; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $302 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $303 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $304 = $302 ^ $303; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $305 = $304 >>> 24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $306 = $301 | $305; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $306; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $307 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $308 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $309 = (($307) + ($308))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $309; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $310 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $311 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $312 = $310 ^ $311; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $313 = $312 << 7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $314 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $315 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $316 = $314 ^ $315; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $317 = $316 >>> 25; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $318 = $313 | $317; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $318; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $319 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $320 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $321 = (($319) + ($320))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $321; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $322 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $323 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $324 = $322 ^ $323; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $325 = $324 << 16; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $326 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $327 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $328 = $326 ^ $327; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $329 = $328 >>> 16; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $330 = $325 | $329; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $330; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $331 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $332 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $333 = (($331) + ($332))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $333; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $334 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $335 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $336 = $334 ^ $335; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $337 = $336 << 12; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $338 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $339 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $340 = $338 ^ $339; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $341 = $340 >>> 20; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $342 = $337 | $341; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $342; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $343 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $344 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $345 = (($343) + ($344))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $345; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $346 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $347 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $348 = $346 ^ $347; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $349 = $348 << 8; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $350 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $351 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $352 = $350 ^ $351; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $353 = $352 >>> 24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $354 = $349 | $353; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $354; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $355 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $356 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $357 = (($355) + ($356))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $357; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $358 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $359 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $360 = $358 ^ $359; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $361 = $360 << 7; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $362 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $363 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $364 = $362 ^ $363; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $365 = $364 >>> 25; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $366 = $361 | $365; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $366; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $367 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $368 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $369 = (($367) + ($368))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $369; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $370 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $371 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $372 = $370 ^ $371; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $373 = $372 << 16; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $374 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $375 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $376 = $374 ^ $375; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $377 = $376 >>> 16; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $378 = $373 | $377; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $378; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $379 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $380 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $381 = (($379) + ($380))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $381; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $382 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $383 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $384 = $382 ^ $383; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $385 = $384 << 12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $386 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $387 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $388 = $386 ^ $387; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $389 = $388 >>> 20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $390 = $385 | $389; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $390; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $391 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $392 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $393 = (($391) + ($392))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $393; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $394 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $395 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $396 = $394 ^ $395; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $397 = $396 << 8; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $398 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $399 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $400 = $398 ^ $399; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $401 = $400 >>> 24; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $402 = $397 | $401; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $402; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $403 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $404 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $405 = (($403) + ($404))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $405; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $406 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $407 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $408 = $406 ^ $407; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $409 = $408 << 7; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $410 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $411 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $412 = $410 ^ $411; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $413 = $412 >>> 25; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $414 = $409 | $413; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $414; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $415 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $416 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $417 = (($415) + ($416))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $417; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $418 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $419 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $420 = $418 ^ $419; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $421 = $420 << 16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $422 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $423 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $424 = $422 ^ $423; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $425 = $424 >>> 16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $426 = $421 | $425; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $426; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $427 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $428 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $429 = (($427) + ($428))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $429; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $430 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $431 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $432 = $430 ^ $431; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $433 = $432 << 12; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $434 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $435 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $436 = $434 ^ $435; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $437 = $436 >>> 20; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $438 = $433 | $437; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $438; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $439 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $440 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $441 = (($439) + ($440))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $441; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $442 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $443 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $444 = $442 ^ $443; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $445 = $444 << 8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $446 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $447 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $448 = $446 ^ $447; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $449 = $448 >>> 24; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $450 = $445 | $449; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $450; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $451 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $452 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $453 = (($451) + ($452))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $453; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $454 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $455 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $456 = $454 ^ $455; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $457 = $456 << 7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $458 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $459 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $460 = $458 ^ $459; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $461 = $460 >>> 25; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $462 = $457 | $461; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $462; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $463 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $464 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $465 = (($463) + ($464))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $465; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $466 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $467 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $468 = $466 ^ $467; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $469 = $468 << 16; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $470 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $471 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $472 = $470 ^ $471; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $473 = $472 >>> 16; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $474 = $469 | $473; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $474; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $475 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $476 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $477 = (($475) + ($476))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $477; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $478 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $479 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $480 = $478 ^ $479; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $481 = $480 << 12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $482 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $483 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $484 = $482 ^ $483; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $485 = $484 >>> 20; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $486 = $481 | $485; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $486; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $487 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $488 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $489 = (($487) + ($488))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $489; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $490 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $491 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $492 = $490 ^ $491; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $493 = $492 << 8; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $494 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $495 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $496 = $494 ^ $495; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $497 = $496 >>> 24; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $498 = $493 | $497; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $498; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $499 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $500 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $501 = (($499) + ($500))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $501; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $502 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $503 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $504 = $502 ^ $503; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $505 = $504 << 7; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $506 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $507 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $508 = $506 ^ $507; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $509 = $508 >>> 25; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $510 = $505 | $509; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $510; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $511 = $i; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $512 = (($511) - 2)|0; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $i = $512; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $513 = $j0; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $514 = (($127) + ($513))|0; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x0 = $514; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $515 = $x1; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $516 = $j1; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $517 = (($515) + ($516))|0; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x1 = $517; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $518 = $x2; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $519 = $j2; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $520 = (($518) + ($519))|0; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x2 = $520; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $521 = $x3; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $522 = $j3; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $523 = (($521) + ($522))|0; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x3 = $523; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $524 = $x4; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $525 = $j4; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $526 = (($524) + ($525))|0; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x4 = $526; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $527 = $x5; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $528 = $j5; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $529 = (($527) + ($528))|0; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x5 = $529; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $530 = $x6; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $531 = $j6; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $532 = (($530) + ($531))|0; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x6 = $532; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $533 = $x7; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $534 = $j7; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $535 = (($533) + ($534))|0; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x7 = $535; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $536 = $x8; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $537 = $j8; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $538 = (($536) + ($537))|0; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x8 = $538; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $539 = $x9; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $540 = $j9; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $541 = (($539) + ($540))|0; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x9 = $541; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $542 = $x10; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $543 = $j10; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $544 = (($542) + ($543))|0; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x10 = $544; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $545 = $x11; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $546 = $j11; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $547 = (($545) + ($546))|0; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x11 = $547; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $548 = $x12; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $549 = $j12; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $550 = (($548) + ($549))|0; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x12 = $550; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $551 = $x13; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $552 = $j13; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $553 = (($551) + ($552))|0; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x13 = $553; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $554 = $x14; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $555 = $j14; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $556 = (($554) + ($555))|0; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x14 = $556; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $557 = $x15; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $558 = $j15; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $559 = (($557) + ($558))|0; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x15 = $559; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $560 = $x0; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $561 = $3; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $562 = (_load32_le($561)|0); //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $563 = $560 ^ $562; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x0 = $563; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $564 = $x1; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $565 = $3; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $566 = ((($565)) + 4|0); //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $567 = (_load32_le($566)|0); //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $568 = $564 ^ $567; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x1 = $568; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $569 = $x2; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $570 = $3; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $571 = ((($570)) + 8|0); //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $572 = (_load32_le($571)|0); //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $573 = $569 ^ $572; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x2 = $573; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $574 = $x3; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $575 = $3; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $576 = ((($575)) + 12|0); //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $577 = (_load32_le($576)|0); //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $578 = $574 ^ $577; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x3 = $578; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $579 = $x4; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $580 = $3; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $581 = ((($580)) + 16|0); //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $582 = (_load32_le($581)|0); //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $583 = $579 ^ $582; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x4 = $583; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $584 = $x5; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $585 = $3; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $586 = ((($585)) + 20|0); //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $587 = (_load32_le($586)|0); //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $588 = $584 ^ $587; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x5 = $588; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $589 = $x6; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $590 = $3; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $591 = ((($590)) + 24|0); //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $592 = (_load32_le($591)|0); //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $593 = $589 ^ $592; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x6 = $593; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $594 = $x7; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $595 = $3; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $596 = ((($595)) + 28|0); //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $597 = (_load32_le($596)|0); //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $598 = $594 ^ $597; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x7 = $598; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $599 = $x8; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $600 = $3; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $601 = ((($600)) + 32|0); //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $602 = (_load32_le($601)|0); //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $603 = $599 ^ $602; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x8 = $603; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $604 = $x9; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $605 = $3; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $606 = ((($605)) + 36|0); //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $607 = (_load32_le($606)|0); //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $608 = $604 ^ $607; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x9 = $608; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $609 = $x10; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $610 = $3; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $611 = ((($610)) + 40|0); //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $612 = (_load32_le($611)|0); //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $613 = $609 ^ $612; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x10 = $613; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $614 = $x11; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $615 = $3; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $616 = ((($615)) + 44|0); //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $617 = (_load32_le($616)|0); //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $618 = $614 ^ $617; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x11 = $618; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $619 = $x12; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $620 = $3; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $621 = ((($620)) + 48|0); //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $622 = (_load32_le($621)|0); //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $623 = $619 ^ $622; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x12 = $623; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $624 = $x13; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $625 = $3; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $626 = ((($625)) + 52|0); //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $627 = (_load32_le($626)|0); //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $628 = $624 ^ $627; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x13 = $628; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $629 = $x14; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $630 = $3; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $631 = ((($630)) + 56|0); //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $632 = (_load32_le($631)|0); //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $633 = $629 ^ $632; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x14 = $633; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $634 = $x15; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $635 = $3; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $636 = ((($635)) + 60|0); //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $637 = (_load32_le($636)|0); //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $638 = $634 ^ $637; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x15 = $638; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $639 = $j12; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $640 = (($639) + 1)|0; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $j12 = $640; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $641 = $j12; //@line 186 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $642 = ($641|0)!=(0); //@line 186 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if (!($642)) {
   $643 = $j13; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $644 = (($643) + 1)|0; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $j13 = $644; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $645 = $4; //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $646 = $x0; //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($645,$646); //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $647 = $4; //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $648 = ((($647)) + 4|0); //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $649 = $x1; //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($648,$649); //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $650 = $4; //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $651 = ((($650)) + 8|0); //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $652 = $x2; //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($651,$652); //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $653 = $4; //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $654 = ((($653)) + 12|0); //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $655 = $x3; //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($654,$655); //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $656 = $4; //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $657 = ((($656)) + 16|0); //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $658 = $x4; //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($657,$658); //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $659 = $4; //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $660 = ((($659)) + 20|0); //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $661 = $x5; //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($660,$661); //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $662 = $4; //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $663 = ((($662)) + 24|0); //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $664 = $x6; //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($663,$664); //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $665 = $4; //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $666 = ((($665)) + 28|0); //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $667 = $x7; //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($666,$667); //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $668 = $4; //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $669 = ((($668)) + 32|0); //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $670 = $x8; //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($669,$670); //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $671 = $4; //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $672 = ((($671)) + 36|0); //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $673 = $x9; //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($672,$673); //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $674 = $4; //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $675 = ((($674)) + 40|0); //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $676 = $x10; //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($675,$676); //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $677 = $4; //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $678 = ((($677)) + 44|0); //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $679 = $x11; //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($678,$679); //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $680 = $4; //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $681 = ((($680)) + 48|0); //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $682 = $x12; //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($681,$682); //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $683 = $4; //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $684 = ((($683)) + 52|0); //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $685 = $x13; //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($684,$685); //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $686 = $4; //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $687 = ((($686)) + 56|0); //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $688 = $x14; //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($687,$688); //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $689 = $4; //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $690 = ((($689)) + 60|0); //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $691 = $x15; //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($690,$691); //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $692 = $5; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $693 = $692; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $694 = HEAP32[$693>>2]|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $695 = (($692) + 4)|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $696 = $695; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $697 = HEAP32[$696>>2]|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $698 = ($697>>>0)<(0); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $699 = ($694>>>0)<=(64); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $700 = ($697|0)==(0); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $701 = $700 & $699; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $702 = $698 | $701; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $703 = $5; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $704 = $703; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $705 = HEAP32[$704>>2]|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $706 = (($703) + 4)|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $707 = $706; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $708 = HEAP32[$707>>2]|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if ($702) {
   break;
  }
  $737 = (_i64Subtract(($705|0),($708|0),64,0)|0); //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $738 = tempRet0; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $739 = $5; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $740 = $739; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  HEAP32[$740>>2] = $737; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $741 = (($739) + 4)|0; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $742 = $741; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  HEAP32[$742>>2] = $738; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $743 = $4; //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $744 = ((($743)) + 64|0); //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $4 = $744; //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $745 = $3; //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $746 = ((($745)) + 64|0); //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $3 = $746; //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $709 = ($708>>>0)<(0); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $710 = ($705>>>0)<(64); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $711 = ($708|0)==(0); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $712 = $711 & $710; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $713 = $709 | $712; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 L25: do {
  if ($713) {
   $i = 0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   while(1) {
    $714 = $i; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $715 = $5; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $716 = $715; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $717 = HEAP32[$716>>2]|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $718 = (($715) + 4)|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $719 = $718; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $720 = HEAP32[$719>>2]|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $721 = ($714>>>0)<($717>>>0); //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    if (!($721)) {
     break L25;
    }
    $722 = $i; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $723 = $4; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $724 = (($723) + ($722)|0); //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $725 = HEAP8[$724>>0]|0; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $726 = $i; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $727 = $ctarget; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $728 = (($727) + ($726)|0); //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    HEAP8[$728>>0] = $725; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $729 = $i; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $730 = (($729) + 1)|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $i = $730; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   }
  }
 } while(0);
 $731 = $j12; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $732 = $2; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $733 = ((($732)) + 48|0); //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$733>>2] = $731; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $734 = $j13; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $735 = $2; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $736 = ((($735)) + 52|0); //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$736>>2] = $734; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 222 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _store32_le($dst,$w) {
 $dst = $dst|0;
 $w = $w|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $dst;
 $1 = $w;
 $2 = $1; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $2&255; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $4 = $0; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$4>>0] = $3; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $5 = $1; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $6 = $5 >>> 8; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $1 = $6; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $7 = $1; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $8 = $7&255; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $9 = $0; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $10 = ((($9)) + 1|0); //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$10>>0] = $8; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $11 = $1; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $12 = $11 >>> 8; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $1 = $12; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $13 = $1; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $14 = $13&255; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $15 = $0; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $16 = ((($15)) + 2|0); //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$16>>0] = $14; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $17 = $1; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $18 = $17 >>> 8; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $1 = $18; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $19 = $1; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $20 = $19&255; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $21 = $0; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $22 = ((($21)) + 3|0); //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$22>>0] = $20; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 STACKTOP = sp;return; //@line 76 "libsodium/src/libsodium/include/sodium/private/common.h"
}
function _stream_ietf_ref($c,$0,$1,$n,$k) {
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp;
 $ctx = sp + 8|0;
 $3 = $c;
 $7 = $4;
 $8 = $7;
 HEAP32[$8>>2] = $0;
 $9 = (($7) + 4)|0;
 $10 = $9;
 HEAP32[$10>>2] = $1;
 $5 = $n;
 $6 = $k;
 $11 = $4; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = $11; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = HEAP32[$12>>2]|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = (($11) + 4)|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = $14; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = HEAP32[$15>>2]|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ($13|0)!=(0); //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ($16|0)!=(0); //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $17 | $18; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($19) {
  $20 = $6; //@line 253 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$20); //@line 253 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $5; //@line 254 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ietf_ivsetup($ctx,$21,0); //@line 254 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $3; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $4; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $23; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = HEAP32[$24>>2]|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = (($23) + 4)|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $26; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = HEAP32[$27>>2]|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _memset(($22|0),0,($25|0))|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = $3; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = $3; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $4; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $31; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = HEAP32[$32>>2]|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = (($31) + 4)|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$29,$30,$33,$36); //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 257 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $2 = 0; //@line 259 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $2 = 0; //@line 250 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _chacha_ietf_ivsetup($ctx,$iv,$counter) {
 $ctx = $ctx|0;
 $iv = $iv|0;
 $counter = $counter|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ctx;
 $1 = $iv;
 $2 = $counter;
 $3 = $2; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $4 = ($3|0)==(0|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($4) {
  $9 = 0;
 } else {
  $5 = $2; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $6 = (_load32_le($5)|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $6;
 }
 $7 = $0; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 48|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = $9; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = $1; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = (_load32_le($10)|0); //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = $0; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = ((($12)) + 52|0); //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$13>>2] = $11; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = $1; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = ((($14)) + 4|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = (_load32_le($15)|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = $0; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ((($17)) + 56|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$18>>2] = $16; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $1; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = ((($19)) + 8|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = (_load32_le($20)|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = $0; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = ((($22)) + 60|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$23>>2] = $21; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 80 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _stream_ref_xor_ic($c,$m,$0,$1,$n,$2,$3,$k) {
 $c = $c|0;
 $m = $m|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $2 = $2|0;
 $3 = $3|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, $ic_bytes = 0, $ic_high = 0, $ic_low = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $7 = sp + 8|0;
 $9 = sp;
 $ctx = sp + 24|0;
 $ic_bytes = sp + 112|0;
 $5 = $c;
 $6 = $m;
 $11 = $7;
 $12 = $11;
 HEAP32[$12>>2] = $0;
 $13 = (($11) + 4)|0;
 $14 = $13;
 HEAP32[$14>>2] = $1;
 $8 = $n;
 $15 = $9;
 $16 = $15;
 HEAP32[$16>>2] = $2;
 $17 = (($15) + 4)|0;
 $18 = $17;
 HEAP32[$18>>2] = $3;
 $10 = $k;
 $19 = $7; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $19; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = HEAP32[$20>>2]|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = (($19) + 4)|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $22; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = HEAP32[$23>>2]|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = ($21|0)!=(0); //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ($24|0)!=(0); //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = $25 | $26; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($27) {
  $28 = $9; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = $28; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = HEAP32[$29>>2]|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = (($28) + 4)|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $31; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = HEAP32[$32>>2]|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $ic_high = $33; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = $9; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = (($34) + 4)|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $38 = $37; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $39 = HEAP32[$38>>2]|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $ic_low = $36; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = $ic_low; //@line 278 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($ic_bytes,$40); //@line 278 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = ((($ic_bytes)) + 4|0); //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $42 = $ic_high; //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($41,$42); //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $43 = $10; //@line 280 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$43); //@line 280 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $44 = $8; //@line 281 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ivsetup($ctx,$44,$ic_bytes); //@line 281 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $45 = $6; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $46 = $5; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $47 = $7; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $48 = $47; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $49 = HEAP32[$48>>2]|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $50 = (($47) + 4)|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $51 = $50; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $52 = HEAP32[$51>>2]|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$45,$46,$49,$52); //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 283 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $4 = 0; //@line 285 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $53 = $4; //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($53|0); //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $4 = 0; //@line 274 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $53 = $4; //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($53|0); //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _stream_ietf_ref_xor_ic($c,$m,$0,$1,$n,$ic,$k) {
 $c = $c|0;
 $m = $m|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $ic = $ic|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, $ic_bytes = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $ctx = sp + 8|0;
 $ic_bytes = sp + 96|0;
 $3 = $c;
 $4 = $m;
 $9 = $5;
 $10 = $9;
 HEAP32[$10>>2] = $0;
 $11 = (($9) + 4)|0;
 $12 = $11;
 HEAP32[$12>>2] = $1;
 $6 = $n;
 $7 = $ic;
 $8 = $k;
 $13 = $5; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = $13; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = HEAP32[$14>>2]|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = (($13) + 4)|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = $16; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = HEAP32[$17>>2]|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = ($15|0)!=(0); //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = ($18|0)!=(0); //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = $19 | $20; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($21) {
  $22 = $7; //@line 300 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($ic_bytes,$22); //@line 300 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $8; //@line 301 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$23); //@line 301 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $6; //@line 302 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ietf_ivsetup($ctx,$24,$ic_bytes); //@line 302 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = $4; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = $3; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $5; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = $27; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = HEAP32[$28>>2]|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = (($27) + 4)|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $30; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = HEAP32[$31>>2]|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$25,$26,$29,$32); //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 304 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $2 = 0; //@line 306 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $2; //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($33|0); //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $2 = 0; //@line 298 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $2; //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($33|0); //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _reduce12289($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c0 = 0, $c1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp;
 $3 = $2;
 $4 = $3;
 HEAP32[$4>>2] = $0;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP32[$6>>2] = $1;
 $7 = $2; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $8 = $7; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $9 = HEAP32[$8>>2]|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $10 = (($7) + 4)|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = $10; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $12 = HEAP32[$11>>2]|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $13 = $9 & 4095; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $c0 = $13; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $14 = $2; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $15 = $14; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $16 = HEAP32[$15>>2]|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $17 = (($14) + 4)|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $18 = $17; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $19 = HEAP32[$18>>2]|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $20 = (_bitshift64Ashr(($16|0),($19|0),12)|0); //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = tempRet0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $c1 = $20; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $22 = $c0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $23 = ($22*3)|0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $24 = $c1; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $25 = (($23) - ($24))|0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 STACKTOP = sp;return ($25|0); //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _reduce12289_2x($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c0 = 0, $c1 = 0, $c2 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp;
 $3 = $2;
 $4 = $3;
 HEAP32[$4>>2] = $0;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP32[$6>>2] = $1;
 $7 = $2; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $8 = $7; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $9 = HEAP32[$8>>2]|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $10 = (($7) + 4)|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = $10; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $12 = HEAP32[$11>>2]|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $13 = $9 & 4095; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $c0 = $13; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $14 = $2; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $15 = $14; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $16 = HEAP32[$15>>2]|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $17 = (($14) + 4)|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $18 = $17; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $19 = HEAP32[$18>>2]|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $20 = (_bitshift64Ashr(($16|0),($19|0),12)|0); //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = tempRet0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $22 = $20 & 4095; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $c1 = $22; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $23 = $2; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $24 = $23; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $25 = HEAP32[$24>>2]|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $26 = (($23) + 4)|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $27 = $26; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $28 = HEAP32[$27>>2]|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $29 = (_bitshift64Ashr(($25|0),($28|0),24)|0); //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $30 = tempRet0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $c2 = $29; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $31 = $c0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $32 = ($31*9)|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $33 = $c1; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $34 = ($33*3)|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $35 = (($32) - ($34))|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $36 = $c2; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $37 = (($35) + ($36))|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 STACKTOP = sp;return ($37|0); //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _NTT_CT_std2rev_12289($a,$psi_rev,$N) {
 $a = $a|0;
 $psi_rev = $psi_rev|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, $S = 0, $U = 0, $V = 0, $i = 0, $j = 0, $j1 = 0, $j2 = 0, $k = 0, $m = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $psi_rev;
 $2 = $N;
 $3 = $2; //@line 41 "LatticeCrypto_v1.0/generic/ntt.c"
 $k = $3; //@line 41 "LatticeCrypto_v1.0/generic/ntt.c"
 $m = 1; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $4 = $m; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = ($4>>>0)<(128); //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($5)) {
   break;
  }
  $6 = $k; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $6 >>> 1; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $k = $7; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = 0; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $8 = $i; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $9 = $m; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $10 = ($8>>>0)<($9>>>0); //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($10)) {
    break;
   }
   $11 = $i; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = $11<<1; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $13 = $k; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $14 = Math_imul($12, $13)|0; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $j1 = $14; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $15 = $j1; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $16 = $k; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $17 = (($15) + ($16))|0; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $18 = (($17) - 1)|0; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $j2 = $18; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $19 = $m; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $20 = $i; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $21 = (($19) + ($20))|0; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $22 = $1; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $23 = (($22) + ($21<<2)|0); //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $24 = HEAP32[$23>>2]|0; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $S = $24; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $25 = $j1; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $25; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $26 = $j; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $27 = $j2; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $28 = ($26>>>0)<=($27>>>0); //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($28)) {
     break;
    }
    $29 = $j; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $30 = $0; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $31 = (($30) + ($29<<2)|0); //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $32 = HEAP32[$31>>2]|0; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $U = $32; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $33 = $j; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $34 = $k; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $35 = (($33) + ($34))|0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $36 = $0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $37 = (($36) + ($35<<2)|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $38 = HEAP32[$37>>2]|0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $39 = ($38|0)<(0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $40 = $39 << 31 >> 31; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $41 = $S; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $42 = ($41|0)<(0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $43 = $42 << 31 >> 31; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $44 = (___muldi3(($38|0),($40|0),($41|0),($43|0))|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $45 = tempRet0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $46 = (_reduce12289($44,$45)|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $V = $46; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $47 = $U; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $48 = $V; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $49 = (($47) + ($48))|0; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $50 = $j; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $51 = $0; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $52 = (($51) + ($50<<2)|0); //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$52>>2] = $49; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $53 = $U; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $54 = $V; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $55 = (($53) - ($54))|0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $56 = $j; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $57 = $k; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $58 = (($56) + ($57))|0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $59 = $0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $60 = (($59) + ($58<<2)|0); //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$60>>2] = $55; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $61 = $j; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $62 = (($61) + 1)|0; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $j = $62; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $63 = $i; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $64 = (($63) + 1)|0; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $i = $64; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $65 = $m; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $66 = $65<<1; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $m = $66; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $k = 4; //@line 59 "LatticeCrypto_v1.0/generic/ntt.c"
 $i = 0; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $67 = $i; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $68 = ($67>>>0)<(128); //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($68)) {
   break;
  }
  $69 = $i; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $70 = $69<<3; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $j1 = $70; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $71 = $j1; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $72 = (($71) + 3)|0; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $j2 = $72; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $73 = $i; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $74 = (($73) + 128)|0; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $75 = $1; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $76 = (($75) + ($74<<2)|0); //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $77 = HEAP32[$76>>2]|0; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $S = $77; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $78 = $j1; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  $j = $78; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $79 = $j; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $80 = $j2; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $81 = ($79>>>0)<=($80>>>0); //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($81)) {
    break;
   }
   $82 = $j; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $83 = $0; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $84 = (($83) + ($82<<2)|0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $85 = HEAP32[$84>>2]|0; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $86 = ($85|0)<(0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $87 = $86 << 31 >> 31; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $88 = (_reduce12289($85,$87)|0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $U = $88; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $89 = $j; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $90 = (($89) + 4)|0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $91 = $0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $92 = (($91) + ($90<<2)|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $93 = HEAP32[$92>>2]|0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $94 = ($93|0)<(0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $95 = $94 << 31 >> 31; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $96 = $S; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $97 = ($96|0)<(0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $98 = $97 << 31 >> 31; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $99 = (___muldi3(($93|0),($95|0),($96|0),($98|0))|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $100 = tempRet0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $101 = (_reduce12289_2x($99,$100)|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $V = $101; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $102 = $U; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $103 = $V; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $104 = (($102) + ($103))|0; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $105 = $j; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $106 = $0; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $107 = (($106) + ($105<<2)|0); //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   HEAP32[$107>>2] = $104; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $108 = $U; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $109 = $V; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $110 = (($108) - ($109))|0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $111 = $j; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $112 = (($111) + 4)|0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $113 = $0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $114 = (($113) + ($112<<2)|0); //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   HEAP32[$114>>2] = $110; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $115 = $j; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $116 = (($115) + 1)|0; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $116; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $117 = $i; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $118 = (($117) + 1)|0; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $118; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $m = 256; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $119 = $m; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $120 = $2; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $121 = ($119>>>0)<($120>>>0); //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($121)) {
   break;
  }
  $122 = $k; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $123 = $122 >>> 1; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $k = $123; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = 0; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $124 = $i; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $125 = $m; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $126 = ($124>>>0)<($125>>>0); //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($126)) {
    break;
   }
   $127 = $i; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $128 = $127<<1; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $129 = $k; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $130 = Math_imul($128, $129)|0; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $j1 = $130; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $131 = $j1; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $132 = $k; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $133 = (($131) + ($132))|0; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $134 = (($133) - 1)|0; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $j2 = $134; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $135 = $m; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $136 = $i; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $137 = (($135) + ($136))|0; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $138 = $1; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $139 = (($138) + ($137<<2)|0); //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $140 = HEAP32[$139>>2]|0; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $S = $140; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $141 = $j1; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $141; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $142 = $j; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $143 = $j2; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $144 = ($142>>>0)<=($143>>>0); //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($144)) {
     break;
    }
    $145 = $j; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $146 = $0; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $147 = (($146) + ($145<<2)|0); //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $148 = HEAP32[$147>>2]|0; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $U = $148; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $149 = $j; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $150 = $k; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $151 = (($149) + ($150))|0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $152 = $0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $153 = (($152) + ($151<<2)|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $154 = HEAP32[$153>>2]|0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $155 = ($154|0)<(0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $156 = $155 << 31 >> 31; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $157 = $S; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $158 = ($157|0)<(0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $159 = $158 << 31 >> 31; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $160 = (___muldi3(($154|0),($156|0),($157|0),($159|0))|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $161 = tempRet0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $162 = (_reduce12289($160,$161)|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $V = $162; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $163 = $U; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $164 = $V; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $165 = (($163) + ($164))|0; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $166 = $j; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $167 = $0; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $168 = (($167) + ($166<<2)|0); //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$168>>2] = $165; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $169 = $U; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $170 = $V; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $171 = (($169) - ($170))|0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $172 = $j; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $173 = $k; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $174 = (($172) + ($173))|0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $175 = $0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $176 = (($175) + ($174<<2)|0); //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$176>>2] = $171; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $177 = $j; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $178 = (($177) + 1)|0; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $j = $178; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $179 = $i; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $180 = (($179) + 1)|0; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $i = $180; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $181 = $m; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $182 = $181<<1; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $m = $182; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 86 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _INTT_GS_rev2std_12289($a,$omegainv_rev,$omegainv1N_rev,$Ninv,$N) {
 $a = $a|0;
 $omegainv_rev = $omegainv_rev|0;
 $omegainv1N_rev = $omegainv1N_rev|0;
 $Ninv = $Ninv|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $S = 0, $U = 0, $V = 0, $h = 0, $i = 0, $j = 0, $j1 = 0, $j2 = 0, $k = 0, $m = 0;
 var $temp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $temp = sp;
 $0 = $a;
 $1 = $omegainv_rev;
 $2 = $omegainv1N_rev;
 $3 = $Ninv;
 $4 = $N;
 $k = 1; //@line 92 "LatticeCrypto_v1.0/generic/ntt.c"
 $5 = $4; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 $m = $5; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $6 = $m; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = ($6>>>0)>(2); //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($7)) {
   break;
  }
  $j1 = 0; //@line 97 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $m; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $8 >>> 1; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $h = $9; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = 0; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $10 = $i; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $11 = $h; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = ($10>>>0)<($11>>>0); //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($12)) {
    break;
   }
   $13 = $j1; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $14 = $k; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $15 = (($13) + ($14))|0; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $16 = (($15) - 1)|0; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $j2 = $16; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $17 = $h; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $18 = $i; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $19 = (($17) + ($18))|0; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $20 = $1; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $21 = (($20) + ($19<<2)|0); //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $22 = HEAP32[$21>>2]|0; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $S = $22; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $23 = $j1; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $23; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $24 = $j; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $25 = $j2; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $26 = ($24>>>0)<=($25>>>0); //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($26)) {
     break;
    }
    $27 = $j; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $28 = $0; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $29 = (($28) + ($27<<2)|0); //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $30 = HEAP32[$29>>2]|0; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $U = $30; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $31 = $j; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $32 = $k; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $33 = (($31) + ($32))|0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $34 = $0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $35 = (($34) + ($33<<2)|0); //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $36 = HEAP32[$35>>2]|0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $V = $36; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $37 = $U; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $38 = $V; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $39 = (($37) + ($38))|0; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $40 = $j; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $41 = $0; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $42 = (($41) + ($40<<2)|0); //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$42>>2] = $39; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $43 = $U; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $44 = $V; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $45 = (($43) - ($44))|0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $46 = ($45|0)<(0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $47 = $46 << 31 >> 31; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $48 = $S; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $49 = ($48|0)<(0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $50 = $49 << 31 >> 31; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $51 = (___muldi3(($45|0),($47|0),($48|0),($50|0))|0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $52 = tempRet0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $53 = $temp; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $54 = $53; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$54>>2] = $51; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $55 = (($53) + 4)|0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $56 = $55; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$56>>2] = $52; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $57 = $m; //@line 107 "LatticeCrypto_v1.0/generic/ntt.c"
    $58 = ($57|0)==(32); //@line 107 "LatticeCrypto_v1.0/generic/ntt.c"
    if ($58) {
     $59 = $j; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $60 = $0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $61 = (($60) + ($59<<2)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $62 = HEAP32[$61>>2]|0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $63 = ($62|0)<(0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $64 = $63 << 31 >> 31; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $65 = (_reduce12289($62,$64)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $66 = $j; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $67 = $0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $68 = (($67) + ($66<<2)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$68>>2] = $65; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $69 = $temp; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $70 = $69; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $71 = HEAP32[$70>>2]|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $72 = (($69) + 4)|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $73 = $72; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $74 = HEAP32[$73>>2]|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $75 = (_reduce12289_2x($71,$74)|0); //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $76 = $j; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $77 = $k; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $78 = (($76) + ($77))|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $79 = $0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $80 = (($79) + ($78<<2)|0); //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$80>>2] = $75; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
    } else {
     $81 = $temp; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $82 = $81; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $83 = HEAP32[$82>>2]|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $84 = (($81) + 4)|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $85 = $84; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $86 = HEAP32[$85>>2]|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $87 = (_reduce12289($83,$86)|0); //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $88 = $j; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $89 = $k; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $90 = (($88) + ($89))|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $91 = $0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $92 = (($91) + ($90<<2)|0); //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$92>>2] = $87; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
    }
    $93 = $j; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $94 = (($93) + 1)|0; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $j = $94; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $95 = $j1; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $96 = $k; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $97 = $96<<1; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $98 = (($95) + ($97))|0; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $j1 = $98; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $99 = $i; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $100 = (($99) + 1)|0; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $i = $100; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $101 = $k; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $102 = $101<<1; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $k = $102; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $103 = $m; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $104 = $103 >>> 1; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $m = $104; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $j = 0; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $105 = $j; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $106 = $k; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $107 = ($105>>>0)<($106>>>0); //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($107)) {
   break;
  }
  $108 = $j; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $109 = $0; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $110 = (($109) + ($108<<2)|0); //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $111 = HEAP32[$110>>2]|0; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $U = $111; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $112 = $j; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $113 = $k; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $114 = (($112) + ($113))|0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $115 = $0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $116 = (($115) + ($114<<2)|0); //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $117 = HEAP32[$116>>2]|0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $V = $117; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $118 = $U; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $119 = $V; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $120 = (($118) + ($119))|0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $121 = ($120|0)<(0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $122 = $121 << 31 >> 31; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $123 = $3; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $124 = ($123|0)<(0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $125 = $124 << 31 >> 31; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $126 = (___muldi3(($120|0),($122|0),($123|0),($125|0))|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $127 = tempRet0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $128 = (_reduce12289($126,$127)|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $129 = $j; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $130 = $0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $131 = (($130) + ($129<<2)|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$131>>2] = $128; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $132 = $U; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $133 = $V; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $134 = (($132) - ($133))|0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $135 = ($134|0)<(0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $136 = $135 << 31 >> 31; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $137 = $2; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $138 = ($137|0)<(0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $139 = $138 << 31 >> 31; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $140 = (___muldi3(($134|0),($136|0),($137|0),($139|0))|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $141 = tempRet0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $142 = (_reduce12289($140,$141)|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $143 = $j; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $144 = $k; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $145 = (($143) + ($144))|0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $146 = $0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $147 = (($146) + ($145<<2)|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$147>>2] = $142; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $148 = $j; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $149 = (($148) + 1)|0; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $j = $149; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 124 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _two_reduce12289($a,$N) {
 $a = $a|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $N;
 $i = 0; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $2 = $i; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $3 = $1; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = ($2>>>0)<($3>>>0); //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = (($6) + ($5<<2)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = HEAP32[$7>>2]|0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = ($8|0)<(0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $9 << 31 >> 31; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = (_reduce12289($8,$10)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $i; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = (($13) + ($12<<2)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$14>>2] = $11; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $i; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = (($16) + ($15<<2)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = HEAP32[$17>>2]|0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = ($18|0)<(0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = $19 << 31 >> 31; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = (_reduce12289($18,$20)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $i; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (($23) + ($22<<2)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$24>>2] = $21; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $i; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = (($25) + 1)|0; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $26; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 136 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _pmul($a,$b,$c,$N) {
 $a = $a|0;
 $b = $b|0;
 $c = $c|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $b;
 $2 = $c;
 $3 = $N;
 $i = 0; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $4 = $i; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = $3; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = ($4>>>0)<($5>>>0); //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($6)) {
   break;
  }
  $7 = $i; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = (($8) + ($7<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = HEAP32[$9>>2]|0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = ($10|0)<(0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $11 << 31 >> 31; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $i; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $1; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = (($14) + ($13<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = HEAP32[$15>>2]|0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = ($16|0)<(0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = $17 << 31 >> 31; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = (___muldi3(($10|0),($12|0),($16|0),($18|0))|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = tempRet0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = (_reduce12289($19,$20)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $i; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $2; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (($23) + ($22<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$24>>2] = $21; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $i; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = $2; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = (($26) + ($25<<2)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = HEAP32[$27>>2]|0; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = ($28|0)<(0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = $29 << 31 >> 31; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = (_reduce12289($28,$30)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = $i; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = $2; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = (($33) + ($32<<2)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$34>>2] = $31; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = $i; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (($35) + 1)|0; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $36; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 147 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _pmuladd($a,$b,$c,$d,$N) {
 $a = $a|0;
 $b = $b|0;
 $c = $c|0;
 $d = $d|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $b;
 $2 = $c;
 $3 = $d;
 $4 = $N;
 $i = 0; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $5 = $i; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $4; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = ($5>>>0)<($6>>>0); //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($7)) {
   break;
  }
  $8 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = (($9) + ($8<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = HEAP32[$10>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = ($11|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $12 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $1; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = (($15) + ($14<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = HEAP32[$16>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = ($17|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $18 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (___muldi3(($11|0),($13|0),($17|0),($19|0))|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = tempRet0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $2; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (($23) + ($22<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = HEAP32[$24>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = ($25|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = $26 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = (_i64Add(($20|0),($21|0),($25|0),($27|0))|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = tempRet0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = (_reduce12289($28,$29)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = $3; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = (($32) + ($31<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$33>>2] = $30; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = $i; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = $3; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (($35) + ($34<<2)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $37 = HEAP32[$36>>2]|0; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $38 = ($37|0)<(0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $39 = $38 << 31 >> 31; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $40 = (_reduce12289($37,$39)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $41 = $i; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $42 = $3; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $43 = (($42) + ($41<<2)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$43>>2] = $40; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $44 = $i; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $45 = (($44) + 1)|0; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $45; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 158 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _smul($a,$scalar,$N) {
 $a = $a|0;
 $scalar = $scalar|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $scalar;
 $2 = $N;
 $i = 0; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $3 = $i; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = $2; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = ($3>>>0)<($4>>>0); //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = (($7) + ($6<<2)|0); //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = HEAP32[$8>>2]|0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $1; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = Math_imul($9, $10)|0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $i; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = (($13) + ($12<<2)|0); //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$14>>2] = $11; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $i; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = (($15) + 1)|0; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $16; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 168 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _correction($a,$p,$N) {
 $a = $a|0;
 $p = $p|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $mask = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $p;
 $2 = $N;
 $i = 0; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $3 = $i; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = $2; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = ($3>>>0)<($4>>>0); //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $0; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = (($7) + ($6<<2)|0); //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = HEAP32[$8>>2]|0; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $9 >> 15; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $mask = $10; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = $1; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $mask; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $11 & $12; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $1; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = (($13) - ($14))|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $i; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = $0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = (($17) + ($16<<2)|0); //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = HEAP32[$18>>2]|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (($19) + ($15))|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$18>>2] = $20; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = $i; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $0; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = (($22) + ($21<<2)|0); //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = HEAP32[$23>>2]|0; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $24 >> 15; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $mask = $25; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = $1; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = $mask; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = $26 & $27; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = $i; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = $0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = (($30) + ($29<<2)|0); //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = HEAP32[$31>>2]|0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = (($32) + ($28))|0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$31>>2] = $33; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = $i; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = (($34) + 1)|0; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $35; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 182 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _clear_words($mem,$nwords) {
 $mem = $mem|0;
 $nwords = $nwords|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $mem;
 $1 = $nwords;
 $2 = $0; //@line 32 "LatticeCrypto_v1.0/kex.c"
 $v = $2; //@line 32 "LatticeCrypto_v1.0/kex.c"
 $i = 0; //@line 34 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $i; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $4 = $1; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $5 = ($3>>>0)<($4>>>0); //@line 34 "LatticeCrypto_v1.0/kex.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $7 = $v; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $8 = (($7) + ($6<<2)|0); //@line 35 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$8>>2] = 0; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $9 = $i; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $10 = (($9) + 1)|0; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $i = $10; //@line 34 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 37 "LatticeCrypto_v1.0/kex.c"
}
function _LatticeCrypto_initialize($pLatticeCrypto,$RandomBytesFunction,$ExtendableOutputFunction,$StreamOutputFunction) {
 $pLatticeCrypto = $pLatticeCrypto|0;
 $RandomBytesFunction = $RandomBytesFunction|0;
 $ExtendableOutputFunction = $ExtendableOutputFunction|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pLatticeCrypto;
 $1 = $RandomBytesFunction;
 $2 = $ExtendableOutputFunction;
 $3 = $StreamOutputFunction;
 $4 = $1; //@line 43 "LatticeCrypto_v1.0/kex.c"
 $5 = $0; //@line 43 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$5>>2] = $4; //@line 43 "LatticeCrypto_v1.0/kex.c"
 $6 = $2; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $7 = $0; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $8 = ((($7)) + 4|0); //@line 44 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$8>>2] = $6; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $9 = $3; //@line 45 "LatticeCrypto_v1.0/kex.c"
 $10 = $0; //@line 45 "LatticeCrypto_v1.0/kex.c"
 $11 = ((($10)) + 8|0); //@line 45 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$11>>2] = $9; //@line 45 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return 0; //@line 47 "LatticeCrypto_v1.0/kex.c"
}
function _LatticeCrypto_allocate() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $LatticeCrypto = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $LatticeCrypto = 0; //@line 54 "LatticeCrypto_v1.0/kex.c"
 $1 = (_calloc(1,12)|0); //@line 56 "LatticeCrypto_v1.0/kex.c"
 $LatticeCrypto = $1; //@line 56 "LatticeCrypto_v1.0/kex.c"
 $2 = $LatticeCrypto; //@line 58 "LatticeCrypto_v1.0/kex.c"
 $3 = ($2|0)==(0|0); //@line 58 "LatticeCrypto_v1.0/kex.c"
 if ($3) {
  $0 = 0; //@line 59 "LatticeCrypto_v1.0/kex.c"
 } else {
  $4 = $LatticeCrypto; //@line 61 "LatticeCrypto_v1.0/kex.c"
  $0 = $4; //@line 61 "LatticeCrypto_v1.0/kex.c"
 }
 $5 = $0; //@line 62 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($5|0); //@line 62 "LatticeCrypto_v1.0/kex.c"
}
function _encode_A($pk,$seed,$m) {
 $pk = $pk|0;
 $seed = $seed|0;
 $m = $m|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pk;
 $1 = $seed;
 $2 = $m;
 $i = 0; //@line 92 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 95 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 95 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $j; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5<<2)|0); //@line 96 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP32[$7>>2]|0; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $9 = $8 & 255; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $10 = $9&255; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $11 = $i; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $12 = $2; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 96 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$13>>0] = $10; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $14 = $j; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $15 = $0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $16 = (($15) + ($14<<2)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  $17 = HEAP32[$16>>2]|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $18 = $17 >>> 8; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $20 = (($19) + 1)|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $21 = $0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $22 = (($21) + ($20<<2)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  $23 = HEAP32[$22>>2]|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $24 = $23 & 3; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $25 = $24 << 6; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $26 = $18 | $25; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $28 = $i; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $29 = (($28) + 1)|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $30 = $2; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + ($29)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$31>>0] = $27; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $32 = $j; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + 1)|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $34 = $0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $35 = (($34) + ($33<<2)|0); //@line 98 "LatticeCrypto_v1.0/kex.c"
  $36 = HEAP32[$35>>2]|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $37 = $36 >>> 2; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $38 = $37 & 255; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $39 = $38&255; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $40 = $i; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $41 = (($40) + 2)|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $42 = $2; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + ($41)|0); //@line 98 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$43>>0] = $39; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $44 = $j; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + 1)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $46 = $0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + ($45<<2)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  $48 = HEAP32[$47>>2]|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $49 = $48 >>> 10; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $50 = $j; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 2)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51<<2)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP32[$53>>2]|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $55 = $54 & 15; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 << 4; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $57 = $49 | $56; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $58 = $57&255; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $59 = $i; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + 3)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $61 = $2; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $62 = (($61) + ($60)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$62>>0] = $58; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $63 = $j; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + 2)|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $65 = $0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + ($64<<2)|0); //@line 100 "LatticeCrypto_v1.0/kex.c"
  $67 = HEAP32[$66>>2]|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $68 = $67 >>> 4; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $69 = $68 & 255; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $71 = $i; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $72 = (($71) + 4)|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $73 = $2; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $74 = (($73) + ($72)|0); //@line 100 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$74>>0] = $70; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $75 = $j; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $76 = (($75) + 2)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $77 = $0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $78 = (($77) + ($76<<2)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  $79 = HEAP32[$78>>2]|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $80 = $79 >>> 12; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $81 = $j; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $82 = (($81) + 3)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $83 = $0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + ($82<<2)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  $85 = HEAP32[$84>>2]|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $86 = $85 & 63; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $87 = $86 << 2; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $88 = $80 | $87; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $89 = $88&255; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $90 = $i; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $91 = (($90) + 5)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $92 = $2; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $93 = (($92) + ($91)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$93>>0] = $89; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $94 = $j; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $95 = (($94) + 3)|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $96 = $0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $97 = (($96) + ($95<<2)|0); //@line 102 "LatticeCrypto_v1.0/kex.c"
  $98 = HEAP32[$97>>2]|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $99 = $98 >>> 6; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $100 = $99&255; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $101 = $i; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $102 = (($101) + 6)|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $103 = $2; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $104 = (($103) + ($102)|0); //@line 102 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$104>>0] = $100; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $105 = $i; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + 7)|0; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $i = $106; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $107 = $j; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $108 = (($107) + 4)|0; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $j = $108; //@line 95 "LatticeCrypto_v1.0/kex.c"
 }
 $j = 0; //@line 111 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $109 = $j; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $110 = ($109>>>0)<(32); //@line 111 "LatticeCrypto_v1.0/kex.c"
  if (!($110)) {
   break;
  }
  $111 = $j; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $112 = $1; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + ($111)|0); //@line 112 "LatticeCrypto_v1.0/kex.c"
  $114 = HEAP8[$113>>0]|0; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $115 = $i; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $116 = $j; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $117 = (($115) + ($116))|0; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $118 = $2; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $119 = (($118) + ($117)|0); //@line 112 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$119>>0] = $114; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $120 = $j; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $121 = (($120) + 1)|0; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $j = $121; //@line 111 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 114 "LatticeCrypto_v1.0/kex.c"
}
function _decode_A($m,$pk,$seed) {
 $m = $m|0;
 $pk = $pk|0;
 $seed = $seed|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $12 = 0, $13 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $m;
 $1 = $pk;
 $2 = $seed;
 $i = 0; //@line 119 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 122 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 122 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP8[$7>>0]|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $9 = $8&255; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $10 = $i; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $11 = (($10) + 1)|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $12 = $0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  $14 = HEAP8[$13>>0]|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $15 = $14&255; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $16 = $15 & 63; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $17 = $16 << 8; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $18 = $9 | $17; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $20 = $1; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $21 = (($20) + ($19<<2)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$21>>2] = $18; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + 1)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $24 = $0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + ($23)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $26 = HEAP8[$25>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $28 = $27 >>> 6; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $29 = $i; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + 2)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $31 = $0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $32 = (($31) + ($30)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $33 = HEAP8[$32>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $34 = $33&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $35 = $34 << 2; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $36 = $28 | $35; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $37 = $i; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + 3)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $39 = $0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + ($38)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $41 = HEAP8[$40>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $42 = $41&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 & 15; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $44 = $43 << 10; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $45 = $36 | $44; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $46 = $j; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + 1)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $48 = $1; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $49 = (($48) + ($47<<2)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$49>>2] = $45; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $50 = $i; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 3)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP8[$53>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $55 = $54&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 >>> 4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $57 = $i; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + 4)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $59 = $0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + ($58)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $61 = HEAP8[$60>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $62 = $61&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $63 = $62 << 4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $64 = $56 | $63; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $65 = $i; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + 5)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $67 = $0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $68 = (($67) + ($66)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $69 = HEAP8[$68>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $71 = $70 & 3; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $72 = $71 << 12; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $73 = $64 | $72; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $74 = $j; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + 2)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $76 = $1; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + ($75<<2)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = $73; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $78 = $i; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 5)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $80 = $0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP8[$81>>0]|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $83 = $82&255; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $84 = $83 >>> 2; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $85 = $i; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + 6)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $87 = $0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $88 = (($87) + ($86)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  $89 = HEAP8[$88>>0]|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $90 = $89&255; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $91 = $90 << 6; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $92 = $84 | $91; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $93 = $j; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $94 = (($93) + 3)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $95 = $1; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + ($94<<2)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = $92; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $97 = $i; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + 7)|0; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $i = $98; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $99 = $j; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + 4)|0; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $j = $100; //@line 122 "LatticeCrypto_v1.0/kex.c"
 }
 $j = 0; //@line 135 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $101 = $j; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $102 = ($101>>>0)<(32); //@line 135 "LatticeCrypto_v1.0/kex.c"
  if (!($102)) {
   break;
  }
  $103 = $i; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $104 = $j; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $105 = (($103) + ($104))|0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $106 = $0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $107 = (($106) + ($105)|0); //@line 136 "LatticeCrypto_v1.0/kex.c"
  $108 = HEAP8[$107>>0]|0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $109 = $j; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $110 = $2; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + ($109)|0); //@line 136 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$111>>0] = $108; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $112 = $j; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + 1)|0; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $j = $113; //@line 135 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 138 "LatticeCrypto_v1.0/kex.c"
}
function _encode_B($pk,$rvec,$m) {
 $pk = $pk|0;
 $rvec = $rvec|0;
 $m = $m|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pk;
 $1 = $rvec;
 $2 = $m;
 $i = 0; //@line 143 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 146 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 146 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $j; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5<<2)|0); //@line 147 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP32[$7>>2]|0; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $9 = $8 & 255; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $10 = $9&255; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $11 = $i; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $12 = $2; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 147 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$13>>0] = $10; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $14 = $j; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $15 = $0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $16 = (($15) + ($14<<2)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  $17 = HEAP32[$16>>2]|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $18 = $17 >>> 8; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $20 = (($19) + 1)|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $21 = $0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $22 = (($21) + ($20<<2)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  $23 = HEAP32[$22>>2]|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $24 = $23 & 3; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $25 = $24 << 6; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $26 = $18 | $25; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $28 = $i; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $29 = (($28) + 1)|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $30 = $2; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + ($29)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$31>>0] = $27; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $32 = $j; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + 1)|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $34 = $0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $35 = (($34) + ($33<<2)|0); //@line 149 "LatticeCrypto_v1.0/kex.c"
  $36 = HEAP32[$35>>2]|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $37 = $36 >>> 2; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $38 = $37 & 255; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $39 = $38&255; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $40 = $i; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $41 = (($40) + 2)|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $42 = $2; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + ($41)|0); //@line 149 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$43>>0] = $39; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $44 = $j; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + 1)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $46 = $0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + ($45<<2)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  $48 = HEAP32[$47>>2]|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $49 = $48 >>> 10; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $50 = $j; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 2)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51<<2)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP32[$53>>2]|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $55 = $54 & 15; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 << 4; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $57 = $49 | $56; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $58 = $57&255; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $59 = $i; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + 3)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $61 = $2; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $62 = (($61) + ($60)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$62>>0] = $58; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $63 = $j; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + 2)|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $65 = $0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + ($64<<2)|0); //@line 151 "LatticeCrypto_v1.0/kex.c"
  $67 = HEAP32[$66>>2]|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $68 = $67 >>> 4; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $69 = $68 & 255; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $71 = $i; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $72 = (($71) + 4)|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $73 = $2; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $74 = (($73) + ($72)|0); //@line 151 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$74>>0] = $70; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $75 = $j; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $76 = (($75) + 2)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $77 = $0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $78 = (($77) + ($76<<2)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  $79 = HEAP32[$78>>2]|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $80 = $79 >>> 12; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $81 = $j; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $82 = (($81) + 3)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $83 = $0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + ($82<<2)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  $85 = HEAP32[$84>>2]|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $86 = $85 & 63; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $87 = $86 << 2; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $88 = $80 | $87; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $89 = $88&255; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $90 = $i; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $91 = (($90) + 5)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $92 = $2; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $93 = (($92) + ($91)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$93>>0] = $89; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $94 = $j; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $95 = (($94) + 3)|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $96 = $0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $97 = (($96) + ($95<<2)|0); //@line 153 "LatticeCrypto_v1.0/kex.c"
  $98 = HEAP32[$97>>2]|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $99 = $98 >>> 6; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $100 = $99&255; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $101 = $i; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $102 = (($101) + 6)|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $103 = $2; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $104 = (($103) + ($102)|0); //@line 153 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$104>>0] = $100; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $105 = $i; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + 7)|0; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $i = $106; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $107 = $j; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $108 = (($107) + 4)|0; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $j = $108; //@line 146 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 161 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 162 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $109 = $j; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $110 = ($109>>>0)<(256); //@line 162 "LatticeCrypto_v1.0/kex.c"
  if (!($110)) {
   break;
  }
  $111 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $112 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + ($111<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $114 = HEAP32[$113>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $115 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $116 = (($115) + 1)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $117 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $118 = (($117) + ($116<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $119 = HEAP32[$118>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $120 = $119 << 2; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $121 = $114 | $120; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $122 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $123 = (($122) + 2)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $124 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $125 = (($124) + ($123<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $126 = HEAP32[$125>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $127 = $126 << 4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $128 = $121 | $127; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $129 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $130 = (($129) + 3)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $131 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $132 = (($131) + ($130<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $133 = HEAP32[$132>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $134 = $133 << 6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $135 = $128 | $134; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $136 = $135&255; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $137 = $j; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $138 = (1792 + ($137))|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $139 = $2; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $140 = (($139) + ($138)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$140>>0] = $136; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $141 = $i; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $142 = (($141) + 4)|0; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $i = $142; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $143 = $j; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $144 = (($143) + 1)|0; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $j = $144; //@line 162 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 166 "LatticeCrypto_v1.0/kex.c"
}
function _decode_B($m,$pk,$rvec) {
 $m = $m|0;
 $pk = $pk|0;
 $rvec = $rvec|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $m;
 $1 = $pk;
 $2 = $rvec;
 $i = 0; //@line 171 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 174 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 174 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP8[$7>>0]|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $9 = $8&255; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $10 = $i; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $11 = (($10) + 1)|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $12 = $0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  $14 = HEAP8[$13>>0]|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $15 = $14&255; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $16 = $15 & 63; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $17 = $16 << 8; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $18 = $9 | $17; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $20 = $1; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $21 = (($20) + ($19<<2)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$21>>2] = $18; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + 1)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $24 = $0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + ($23)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $26 = HEAP8[$25>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $28 = $27 >>> 6; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $29 = $i; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + 2)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $31 = $0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $32 = (($31) + ($30)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $33 = HEAP8[$32>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $34 = $33&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $35 = $34 << 2; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $36 = $28 | $35; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $37 = $i; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + 3)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $39 = $0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + ($38)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $41 = HEAP8[$40>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $42 = $41&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 & 15; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $44 = $43 << 10; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $45 = $36 | $44; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $46 = $j; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + 1)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $48 = $1; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $49 = (($48) + ($47<<2)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$49>>2] = $45; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $50 = $i; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 3)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP8[$53>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $55 = $54&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 >>> 4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $57 = $i; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + 4)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $59 = $0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + ($58)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $61 = HEAP8[$60>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $62 = $61&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $63 = $62 << 4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $64 = $56 | $63; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $65 = $i; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + 5)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $67 = $0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $68 = (($67) + ($66)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $69 = HEAP8[$68>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $71 = $70 & 3; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $72 = $71 << 12; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $73 = $64 | $72; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $74 = $j; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + 2)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $76 = $1; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + ($75<<2)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = $73; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $78 = $i; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 5)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $80 = $0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP8[$81>>0]|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $83 = $82&255; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $84 = $83 >>> 2; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $85 = $i; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + 6)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $87 = $0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $88 = (($87) + ($86)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  $89 = HEAP8[$88>>0]|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $90 = $89&255; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $91 = $90 << 6; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $92 = $84 | $91; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $93 = $j; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $94 = (($93) + 3)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $95 = $1; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + ($94<<2)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = $92; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $97 = $i; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + 7)|0; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $i = $98; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $99 = $j; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + 4)|0; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $j = $100; //@line 174 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 187 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 188 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $101 = $j; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $102 = ($101>>>0)<(256); //@line 188 "LatticeCrypto_v1.0/kex.c"
  if (!($102)) {
   break;
  }
  $103 = $j; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $104 = (1792 + ($103))|0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $105 = $0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + ($104)|0); //@line 189 "LatticeCrypto_v1.0/kex.c"
  $107 = HEAP8[$106>>0]|0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $108 = $107&255; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $109 = $108 & 3; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $110 = $i; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $111 = $2; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $112 = (($111) + ($110<<2)|0); //@line 189 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$112>>2] = $109; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $113 = $j; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $114 = (1792 + ($113))|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $115 = $0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $116 = (($115) + ($114)|0); //@line 190 "LatticeCrypto_v1.0/kex.c"
  $117 = HEAP8[$116>>0]|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $118 = $117&255; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $119 = $118 >> 2; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $120 = $119 & 3; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $121 = $i; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $122 = (($121) + 1)|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $123 = $2; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $124 = (($123) + ($122<<2)|0); //@line 190 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$124>>2] = $120; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $125 = $j; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $126 = (1792 + ($125))|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $127 = $0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $128 = (($127) + ($126)|0); //@line 191 "LatticeCrypto_v1.0/kex.c"
  $129 = HEAP8[$128>>0]|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $130 = $129&255; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $131 = $130 >> 4; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $132 = $131 & 3; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $133 = $i; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $134 = (($133) + 2)|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $135 = $2; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $136 = (($135) + ($134<<2)|0); //@line 191 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$136>>2] = $132; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $137 = $j; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $138 = (1792 + ($137))|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $139 = $0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $140 = (($139) + ($138)|0); //@line 192 "LatticeCrypto_v1.0/kex.c"
  $141 = HEAP8[$140>>0]|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $142 = $141&255; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $143 = $142 >> 6; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $144 = $i; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $145 = (($144) + 3)|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $146 = $2; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $147 = (($146) + ($145<<2)|0); //@line 192 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$147>>2] = $143; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $148 = $i; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $149 = (($148) + 4)|0; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $i = $149; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $150 = $j; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $151 = (($150) + 1)|0; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $j = $151; //@line 188 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 195 "LatticeCrypto_v1.0/kex.c"
}
function _HelpRec($x,$rvec,$seed,$nonce,$StreamOutputFunction) {
 $x = $x|0;
 $rvec = $rvec|0;
 $seed = $seed|0;
 $nonce = $nonce|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $Status = 0, $bit = 0, $i = 0, $j = 0, $nce = 0, $norm = 0, $random_bits = 0, $v0 = 0, $v1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $random_bits = sp + 88|0;
 $nce = sp + 80|0;
 $v0 = sp + 24|0;
 $v1 = sp + 8|0;
 $1 = $x;
 $2 = $rvec;
 $3 = $seed;
 $4 = $nonce;
 $5 = $StreamOutputFunction;
 ;HEAP8[$nce>>0]=0|0;HEAP8[$nce+1>>0]=0|0;HEAP8[$nce+2>>0]=0|0;HEAP8[$nce+3>>0]=0|0;HEAP8[$nce+4>>0]=0|0;HEAP8[$nce+5>>0]=0|0;HEAP8[$nce+6>>0]=0|0;HEAP8[$nce+7>>0]=0|0; //@line 210 "LatticeCrypto_v1.0/kex.c"
 $Status = 3; //@line 212 "LatticeCrypto_v1.0/kex.c"
 $6 = $4; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $7 = $6&255; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $8 = ((($nce)) + 1|0); //@line 214 "LatticeCrypto_v1.0/kex.c"
 HEAP8[$8>>0] = $7; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $9 = $3; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $10 = $5; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $11 = (_stream_output($9,32,$nce,32,32,$random_bits,$10)|0); //@line 215 "LatticeCrypto_v1.0/kex.c"
 $Status = $11; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $12 = $Status; //@line 216 "LatticeCrypto_v1.0/kex.c"
 $13 = ($12|0)!=(0); //@line 216 "LatticeCrypto_v1.0/kex.c"
 if ($13) {
  _clear_words($random_bits,8); //@line 217 "LatticeCrypto_v1.0/kex.c"
  $14 = $Status; //@line 218 "LatticeCrypto_v1.0/kex.c"
  $0 = $14; //@line 218 "LatticeCrypto_v1.0/kex.c"
  $280 = $0; //@line 259 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($280|0); //@line 259 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 225 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $15 = $i; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $16 = ($15>>>0)<(256); //@line 225 "LatticeCrypto_v1.0/kex.c"
  if (!($16)) {
   break;
  }
  $17 = $i; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $18 = $17 >>> 3; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $19 = (($random_bits) + ($18)|0); //@line 226 "LatticeCrypto_v1.0/kex.c"
  $20 = HEAP8[$19>>0]|0; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $21 = $20&255; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $23 = $22 & 7; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $24 = $21 >> $23; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $25 = 1 & $24; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $26 = $25&255; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $bit = $26; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $27 = $i; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $28 = $1; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $29 = (($28) + ($27<<2)|0); //@line 227 "LatticeCrypto_v1.0/kex.c"
  $30 = HEAP32[$29>>2]|0; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $31 = $30 << 1; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $32 = $bit; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $33 = $32&255; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $34 = (($31) - ($33))|0; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $35 = $i; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $36 = $2; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $37 = (($36) + ($35<<2)|0); //@line 227 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$37>>2] = $34; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $38 = $i; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $39 = (($38) + 256)|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $40 = $1; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $41 = (($40) + ($39<<2)|0); //@line 228 "LatticeCrypto_v1.0/kex.c"
  $42 = HEAP32[$41>>2]|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 << 1; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $44 = $bit; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $45 = $44&255; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $46 = (($43) - ($45))|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $47 = $i; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $48 = (($47) + 256)|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $49 = $2; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $50 = (($49) + ($48<<2)|0); //@line 228 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$50>>2] = $46; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $51 = $i; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + 512)|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $53 = $1; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $54 = (($53) + ($52<<2)|0); //@line 229 "LatticeCrypto_v1.0/kex.c"
  $55 = HEAP32[$54>>2]|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 << 1; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $57 = $bit; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $58 = $57&255; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $59 = (($56) - ($58))|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $60 = $i; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $61 = (($60) + 512)|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $62 = $2; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $63 = (($62) + ($61<<2)|0); //@line 229 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$63>>2] = $59; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $64 = $i; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + 768)|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $66 = $1; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $67 = (($66) + ($65<<2)|0); //@line 230 "LatticeCrypto_v1.0/kex.c"
  $68 = HEAP32[$67>>2]|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $69 = $68 << 1; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $70 = $bit; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $71 = $70&255; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $72 = (($69) - ($71))|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $73 = $i; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $74 = (($73) + 768)|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $75 = $2; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $76 = (($75) + ($74<<2)|0); //@line 230 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$76>>2] = $72; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $norm = 0; //@line 232 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$v0>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $77 = ((($v0)) + 4|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $78 = ((($v0)) + 8|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$78>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $79 = ((($v0)) + 12|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$79>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$v1>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $80 = ((($v1)) + 4|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$80>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $81 = ((($v1)) + 8|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$81>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $82 = ((($v1)) + 12|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$82>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $j = 0; //@line 235 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $83 = $j; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $84 = ($83>>>0)<(4); //@line 235 "LatticeCrypto_v1.0/kex.c"
   if (!($84)) {
    break;
   }
   $85 = $i; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $86 = $j; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $87 = $86<<8; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $88 = (($85) + ($87))|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $89 = $2; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $90 = (($89) + ($88<<2)|0); //@line 236 "LatticeCrypto_v1.0/kex.c"
   $91 = HEAP32[$90>>2]|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $92 = (($91) - 3073)|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $93 = $92 >>> 31; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $94 = $j; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $95 = (($v0) + ($94<<2)|0); //@line 236 "LatticeCrypto_v1.0/kex.c"
   $96 = HEAP32[$95>>2]|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $97 = (($96) - ($93))|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$95>>2] = $97; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $98 = $i; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $99 = $j; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $100 = $99<<8; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $101 = (($98) + ($100))|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $102 = $2; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $103 = (($102) + ($101<<2)|0); //@line 237 "LatticeCrypto_v1.0/kex.c"
   $104 = HEAP32[$103>>2]|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $105 = (($104) - 9217)|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $106 = $105 >>> 31; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $107 = $j; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $108 = (($v0) + ($107<<2)|0); //@line 237 "LatticeCrypto_v1.0/kex.c"
   $109 = HEAP32[$108>>2]|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $110 = (($109) - ($106))|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$108>>2] = $110; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $111 = $i; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $112 = $j; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $113 = $112<<8; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $114 = (($111) + ($113))|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $115 = $2; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $116 = (($115) + ($114<<2)|0); //@line 238 "LatticeCrypto_v1.0/kex.c"
   $117 = HEAP32[$116>>2]|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $118 = (($117) - 15362)|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $119 = $118 >>> 31; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $120 = $j; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $121 = (($v0) + ($120<<2)|0); //@line 238 "LatticeCrypto_v1.0/kex.c"
   $122 = HEAP32[$121>>2]|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $123 = (($122) - ($119))|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$121>>2] = $123; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $124 = $i; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $125 = $j; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $126 = $125<<8; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $127 = (($124) + ($126))|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $128 = $2; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $129 = (($128) + ($127<<2)|0); //@line 239 "LatticeCrypto_v1.0/kex.c"
   $130 = HEAP32[$129>>2]|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $131 = (($130) - 21506)|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $132 = $131 >>> 31; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $133 = $j; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $134 = (($v0) + ($133<<2)|0); //@line 239 "LatticeCrypto_v1.0/kex.c"
   $135 = HEAP32[$134>>2]|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $136 = (($135) - ($132))|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$134>>2] = $136; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $137 = $i; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $138 = $j; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $139 = $138<<8; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $140 = (($137) + ($139))|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $141 = $2; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $142 = (($141) + ($140<<2)|0); //@line 240 "LatticeCrypto_v1.0/kex.c"
   $143 = HEAP32[$142>>2]|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $144 = (($143) - 6145)|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $145 = $144 >>> 31; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $146 = $j; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $147 = (($v1) + ($146<<2)|0); //@line 240 "LatticeCrypto_v1.0/kex.c"
   $148 = HEAP32[$147>>2]|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $149 = (($148) - ($145))|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$147>>2] = $149; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $150 = $i; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $151 = $j; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $152 = $151<<8; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $153 = (($150) + ($152))|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $154 = $2; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $155 = (($154) + ($153<<2)|0); //@line 241 "LatticeCrypto_v1.0/kex.c"
   $156 = HEAP32[$155>>2]|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $157 = (($156) - 12289)|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $158 = $157 >>> 31; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $159 = $j; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $160 = (($v1) + ($159<<2)|0); //@line 241 "LatticeCrypto_v1.0/kex.c"
   $161 = HEAP32[$160>>2]|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $162 = (($161) - ($158))|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$160>>2] = $162; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $163 = $i; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $164 = $j; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $165 = $164<<8; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $166 = (($163) + ($165))|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $167 = $2; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $168 = (($167) + ($166<<2)|0); //@line 242 "LatticeCrypto_v1.0/kex.c"
   $169 = HEAP32[$168>>2]|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $170 = (($169) - 18434)|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $171 = $170 >>> 31; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $172 = $j; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $173 = (($v1) + ($172<<2)|0); //@line 242 "LatticeCrypto_v1.0/kex.c"
   $174 = HEAP32[$173>>2]|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $175 = (($174) - ($171))|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$173>>2] = $175; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $176 = $i; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $177 = $j; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $178 = $177<<8; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $179 = (($176) + ($178))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $180 = $2; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $181 = (($180) + ($179<<2)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $182 = HEAP32[$181>>2]|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $183 = $182<<1; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $184 = $j; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $185 = (($v0) + ($184<<2)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $186 = HEAP32[$185>>2]|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $187 = ($186*12289)|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $188 = (($183) - ($187))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $189 = (_Abs($188)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $190 = $norm; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $191 = (($190) + ($189))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $norm = $191; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $192 = $j; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $193 = (($192) + 1)|0; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $j = $193; //@line 235 "LatticeCrypto_v1.0/kex.c"
  }
  $194 = $norm; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $195 = (($194) - 12289)|0; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $196 = $195 >> 31; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $norm = $196; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $197 = $norm; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $198 = HEAP32[$v0>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $199 = HEAP32[$v1>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $200 = $198 ^ $199; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $201 = $197 & $200; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $202 = HEAP32[$v1>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $203 = $201 ^ $202; //@line 247 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$v0>>2] = $203; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $204 = $norm; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $205 = ((($v0)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $206 = HEAP32[$205>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $207 = ((($v1)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $208 = HEAP32[$207>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $209 = $206 ^ $208; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $210 = $204 & $209; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $211 = ((($v1)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $212 = HEAP32[$211>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $213 = $210 ^ $212; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $214 = ((($v0)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$214>>2] = $213; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $215 = $norm; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $216 = ((($v0)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $217 = HEAP32[$216>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $218 = ((($v1)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $219 = HEAP32[$218>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $220 = $217 ^ $219; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $221 = $215 & $220; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $222 = ((($v1)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $223 = HEAP32[$222>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $224 = $221 ^ $223; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $225 = ((($v0)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$225>>2] = $224; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $226 = $norm; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $227 = ((($v0)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $228 = HEAP32[$227>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $229 = ((($v1)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $230 = HEAP32[$229>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $231 = $228 ^ $230; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $232 = $226 & $231; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $233 = ((($v1)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $234 = HEAP32[$233>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $235 = $232 ^ $234; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $236 = ((($v0)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$236>>2] = $235; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $237 = HEAP32[$v0>>2]|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $238 = ((($v0)) + 12|0); //@line 251 "LatticeCrypto_v1.0/kex.c"
  $239 = HEAP32[$238>>2]|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $240 = (($237) - ($239))|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $241 = $240 & 3; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $242 = $i; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $243 = $2; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $244 = (($243) + ($242<<2)|0); //@line 251 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$244>>2] = $241; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $245 = ((($v0)) + 4|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  $246 = HEAP32[$245>>2]|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $247 = ((($v0)) + 12|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  $248 = HEAP32[$247>>2]|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $249 = (($246) - ($248))|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $250 = $249 & 3; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $251 = $i; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $252 = (($251) + 256)|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $253 = $2; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $254 = (($253) + ($252<<2)|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$254>>2] = $250; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $255 = ((($v0)) + 8|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  $256 = HEAP32[$255>>2]|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $257 = ((($v0)) + 12|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  $258 = HEAP32[$257>>2]|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $259 = (($256) - ($258))|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $260 = $259 & 3; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $261 = $i; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $262 = (($261) + 512)|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $263 = $2; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $264 = (($263) + ($262<<2)|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$264>>2] = $260; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $265 = ((($v0)) + 12|0); //@line 254 "LatticeCrypto_v1.0/kex.c"
  $266 = HEAP32[$265>>2]|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $267 = $266 << 1; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $268 = $norm; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $269 = $268 ^ -1; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $270 = 1 & $269; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $271 = (($267) + ($270))|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $272 = $271 & 3; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $273 = $i; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $274 = (($273) + 768)|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $275 = $2; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $276 = (($275) + ($274<<2)|0); //@line 254 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$276>>2] = $272; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $277 = $i; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $278 = (($277) + 1)|0; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $i = $278; //@line 225 "LatticeCrypto_v1.0/kex.c"
 }
 $279 = $Status; //@line 258 "LatticeCrypto_v1.0/kex.c"
 $0 = $279; //@line 258 "LatticeCrypto_v1.0/kex.c"
 $280 = $0; //@line 259 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($280|0); //@line 259 "LatticeCrypto_v1.0/kex.c"
}
function _Rec($x,$rvec,$key) {
 $x = $x|0;
 $rvec = $rvec|0;
 $key = $key|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $i = 0, $t = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $t = sp;
 $0 = $x;
 $1 = $rvec;
 $2 = $key;
 $i = 0; //@line 287 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $i; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(32); //@line 287 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $6 = $2; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5)|0); //@line 288 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$7>>0] = 0; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $8 = $i; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $9 = (($8) + 1)|0; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $i = $9; //@line 287 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 290 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $10 = $i; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $11 = ($10>>>0)<(256); //@line 290 "LatticeCrypto_v1.0/kex.c"
  if (!($11)) {
   break;
  }
  $12 = $i; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $13 = $0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $14 = (($13) + ($12<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $15 = HEAP32[$14>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $16 = $15<<3; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $17 = $i; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $18 = $1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $19 = (($18) + ($17<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $20 = HEAP32[$19>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $21 = $20<<1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + 768)|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $24 = $1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + ($23<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $26 = HEAP32[$25>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $27 = (($21) + ($26))|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $28 = ($27*12289)|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $29 = (($16) - ($28))|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$t>>2] = $29; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $30 = $i; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + 256)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $32 = $0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + ($31<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $34 = HEAP32[$33>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $35 = $34<<3; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $36 = $i; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $37 = (($36) + 256)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $38 = $1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $39 = (($38) + ($37<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $40 = HEAP32[$39>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $41 = $40<<1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $42 = $i; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + 768)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $44 = $1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + ($43<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $46 = HEAP32[$45>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $47 = (($41) + ($46))|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $48 = ($47*12289)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $49 = (($35) - ($48))|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $50 = ((($t)) + 4|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$50>>2] = $49; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $51 = $i; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + 512)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $53 = $0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $54 = (($53) + ($52<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $55 = HEAP32[$54>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $56 = $55<<3; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $57 = $i; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + 512)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $59 = $1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + ($58<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $61 = HEAP32[$60>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $62 = $61<<1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $63 = $i; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + 768)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $65 = $1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + ($64<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $67 = HEAP32[$66>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $68 = (($62) + ($67))|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $69 = ($68*12289)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $70 = (($56) - ($69))|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $71 = ((($t)) + 8|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$71>>2] = $70; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $72 = $i; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $73 = (($72) + 768)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $74 = $0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + ($73<<2)|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  $76 = HEAP32[$75>>2]|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $77 = $76<<3; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $78 = $i; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 768)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $80 = $1; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79<<2)|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP32[$81>>2]|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $83 = ($82*12289)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $84 = (($77) - ($83))|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $85 = ((($t)) + 12|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$85>>2] = $84; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $86 = (_LDDecode($t)|0); //@line 296 "LatticeCrypto_v1.0/kex.c"
  $87 = $86&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $88 = $87&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $89 = $i; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $90 = $89 & 7; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $91 = $88 << $90; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $92 = $i; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $93 = $92 >>> 3; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $94 = $2; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $95 = (($94) + ($93)|0); //@line 296 "LatticeCrypto_v1.0/kex.c"
  $96 = HEAP8[$95>>0]|0; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $97 = $96&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $98 = $97 | $91; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $99 = $98&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$95>>0] = $99; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $100 = $i; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $101 = (($100) + 1)|0; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $i = $101; //@line 290 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 302 "LatticeCrypto_v1.0/kex.c"
}
function _get_error($e,$seed,$nonce,$StreamOutputFunction) {
 $e = $e|0;
 $seed = $seed|0;
 $nonce = $nonce|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $Status = 0, $acc1 = 0, $acc2 = 0, $i = 0;
 var $j = 0, $nce = 0, $pacc1 = 0, $pacc2 = 0, $pstream = 0, $stream = 0, $temp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 3136|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $stream = sp + 64|0;
 $acc1 = sp + 28|0;
 $acc2 = sp + 24|0;
 $nce = sp + 56|0;
 $1 = $e;
 $2 = $seed;
 $3 = $nonce;
 $4 = $StreamOutputFunction;
 $pstream = $stream; //@line 308 "LatticeCrypto_v1.0/kex.c"
 $pacc1 = $acc1; //@line 310 "LatticeCrypto_v1.0/kex.c"
 $pacc2 = $acc2; //@line 310 "LatticeCrypto_v1.0/kex.c"
 ;HEAP8[$nce>>0]=0|0;HEAP8[$nce+1>>0]=0|0;HEAP8[$nce+2>>0]=0|0;HEAP8[$nce+3>>0]=0|0;HEAP8[$nce+4>>0]=0|0;HEAP8[$nce+5>>0]=0|0;HEAP8[$nce+6>>0]=0|0;HEAP8[$nce+7>>0]=0|0; //@line 311 "LatticeCrypto_v1.0/kex.c"
 $Status = 3; //@line 313 "LatticeCrypto_v1.0/kex.c"
 $5 = $3; //@line 315 "LatticeCrypto_v1.0/kex.c"
 $6 = $5&255; //@line 315 "LatticeCrypto_v1.0/kex.c"
 HEAP8[$nce>>0] = $6; //@line 315 "LatticeCrypto_v1.0/kex.c"
 $7 = $2; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $8 = $4; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $9 = (_stream_output($7,32,$nce,32,3072,$stream,$8)|0); //@line 316 "LatticeCrypto_v1.0/kex.c"
 $Status = $9; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $10 = $Status; //@line 317 "LatticeCrypto_v1.0/kex.c"
 $11 = ($10|0)!=(0); //@line 317 "LatticeCrypto_v1.0/kex.c"
 if ($11) {
  _clear_words($stream,768); //@line 318 "LatticeCrypto_v1.0/kex.c"
  $12 = $Status; //@line 319 "LatticeCrypto_v1.0/kex.c"
  $0 = $12; //@line 319 "LatticeCrypto_v1.0/kex.c"
  $115 = $0; //@line 346 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($115|0); //@line 346 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 325 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $13 = $i; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $14 = ($13>>>0)<(256); //@line 325 "LatticeCrypto_v1.0/kex.c"
  if (!($14)) {
   break;
  }
  HEAP32[$acc1>>2] = 0; //@line 327 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$acc2>>2] = 0; //@line 328 "LatticeCrypto_v1.0/kex.c"
  $j = 0; //@line 329 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $15 = $j; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $16 = ($15>>>0)<(8); //@line 329 "LatticeCrypto_v1.0/kex.c"
   if (!($16)) {
    break;
   }
   $17 = $i; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $18 = $pstream; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $19 = (($18) + ($17<<2)|0); //@line 330 "LatticeCrypto_v1.0/kex.c"
   $20 = HEAP32[$19>>2]|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $21 = $j; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $22 = $20 >>> $21; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $23 = $22 & 16843009; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $24 = HEAP32[$acc1>>2]|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $25 = (($24) + ($23))|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc1>>2] = $25; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $26 = $i; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $27 = (($26) + 256)|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $28 = $pstream; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $29 = (($28) + ($27<<2)|0); //@line 331 "LatticeCrypto_v1.0/kex.c"
   $30 = HEAP32[$29>>2]|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $31 = $j; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $32 = $30 >>> $31; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $33 = $32 & 16843009; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $34 = HEAP32[$acc2>>2]|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $35 = (($34) + ($33))|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc2>>2] = $35; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $36 = $j; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $37 = (($36) + 1)|0; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $j = $37; //@line 329 "LatticeCrypto_v1.0/kex.c"
  }
  $j = 0; //@line 333 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $38 = $j; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $39 = ($38>>>0)<(4); //@line 333 "LatticeCrypto_v1.0/kex.c"
   if (!($39)) {
    break;
   }
   $40 = $i; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $41 = (($40) + 512)|0; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $42 = $pstream; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $43 = (($42) + ($41<<2)|0); //@line 334 "LatticeCrypto_v1.0/kex.c"
   $44 = HEAP32[$43>>2]|0; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $45 = $j; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $46 = $44 >>> $45; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $temp = $46; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $47 = $temp; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $48 = $47 & 16843009; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $49 = HEAP32[$acc1>>2]|0; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $50 = (($49) + ($48))|0; //@line 335 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc1>>2] = $50; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $51 = $temp; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $52 = $51 >>> 4; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $53 = $52 & 16843009; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $54 = HEAP32[$acc2>>2]|0; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $55 = (($54) + ($53))|0; //@line 336 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc2>>2] = $55; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $56 = $j; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $57 = (($56) + 1)|0; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $j = $57; //@line 333 "LatticeCrypto_v1.0/kex.c"
  }
  $58 = $pacc1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $59 = HEAP8[$58>>0]|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $60 = $59&255; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $61 = $pacc1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $62 = ((($61)) + 1|0); //@line 338 "LatticeCrypto_v1.0/kex.c"
  $63 = HEAP8[$62>>0]|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $64 = $63&255; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $65 = (($60) - ($64))|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $66 = $i; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $67 = $66<<1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $68 = $1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $69 = (($68) + ($67<<2)|0); //@line 338 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$69>>2] = $65; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $70 = $pacc1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $71 = ((($70)) + 2|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  $72 = HEAP8[$71>>0]|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $73 = $72&255; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $74 = $pacc1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $75 = ((($74)) + 3|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  $76 = HEAP8[$75>>0]|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $77 = $76&255; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $78 = (($73) - ($77))|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $79 = $i; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $80 = $79<<1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + 1)|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $82 = $1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $83 = (($82) + ($81<<2)|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$83>>2] = $78; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $84 = $pacc2; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $85 = HEAP8[$84>>0]|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $86 = $85&255; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $87 = $pacc2; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $88 = ((($87)) + 1|0); //@line 340 "LatticeCrypto_v1.0/kex.c"
  $89 = HEAP8[$88>>0]|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $90 = $89&255; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $91 = (($86) - ($90))|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $92 = $i; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $93 = $92<<1; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $94 = (($93) + 512)|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $95 = $1; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + ($94<<2)|0); //@line 340 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = $91; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $97 = $pacc2; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $98 = ((($97)) + 2|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  $99 = HEAP8[$98>>0]|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $100 = $99&255; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $101 = $pacc2; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $102 = ((($101)) + 3|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  $103 = HEAP8[$102>>0]|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $104 = $103&255; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $105 = (($100) - ($104))|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $106 = $i; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $107 = $106<<1; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $108 = (($107) + 512)|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $109 = (($108) + 1)|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $110 = $1; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + ($109<<2)|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$111>>2] = $105; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $112 = $i; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + 1)|0; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $i = $113; //@line 325 "LatticeCrypto_v1.0/kex.c"
 }
 $114 = $Status; //@line 345 "LatticeCrypto_v1.0/kex.c"
 $0 = $114; //@line 345 "LatticeCrypto_v1.0/kex.c"
 $115 = $0; //@line 346 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($115|0); //@line 346 "LatticeCrypto_v1.0/kex.c"
}
function _generate_a($a,$seed,$ExtendableOutputFunction) {
 $a = $a|0;
 $seed = $seed|0;
 $ExtendableOutputFunction = $ExtendableOutputFunction|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $seed;
 $2 = $ExtendableOutputFunction;
 $3 = $1; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $4 = $0; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $5 = $2; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $6 = (_extended_output($3,32,1024,$4,$5)|0); //@line 352 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($6|0); //@line 352 "LatticeCrypto_v1.0/kex.c"
}
function _KeyGeneration_A($SecretKeyA,$PublicKeyA,$pLatticeCrypto) {
 $SecretKeyA = $SecretKeyA|0;
 $PublicKeyA = $PublicKeyA|0;
 $pLatticeCrypto = $pLatticeCrypto|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $Status = 0;
 var $a = 0, $e = 0, $error_seed = 0, $seed = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 8288|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $a = sp + 4104|0;
 $e = sp + 8|0;
 $seed = sp + 8248|0;
 $error_seed = sp + 8216|0;
 $1 = $SecretKeyA;
 $2 = $PublicKeyA;
 $3 = $pLatticeCrypto;
 $Status = 3; //@line 365 "LatticeCrypto_v1.0/kex.c"
 $4 = $3; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $5 = HEAP32[$4>>2]|0; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $6 = (_random_bytes(32,$seed,$5)|0); //@line 367 "LatticeCrypto_v1.0/kex.c"
 $Status = $6; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $7 = $Status; //@line 368 "LatticeCrypto_v1.0/kex.c"
 $8 = ($7|0)!=(0); //@line 368 "LatticeCrypto_v1.0/kex.c"
 if ($8) {
  $9 = $Status; //@line 369 "LatticeCrypto_v1.0/kex.c"
  $0 = $9; //@line 369 "LatticeCrypto_v1.0/kex.c"
  $38 = $0; //@line 402 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($38|0); //@line 402 "LatticeCrypto_v1.0/kex.c"
 }
 $10 = $3; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $11 = HEAP32[$10>>2]|0; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $12 = (_random_bytes(32,$error_seed,$11)|0); //@line 371 "LatticeCrypto_v1.0/kex.c"
 $Status = $12; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $13 = $Status; //@line 372 "LatticeCrypto_v1.0/kex.c"
 $14 = ($13|0)!=(0); //@line 372 "LatticeCrypto_v1.0/kex.c"
 if (!($14)) {
  $15 = $3; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $16 = ((($15)) + 4|0); //@line 376 "LatticeCrypto_v1.0/kex.c"
  $17 = HEAP32[$16>>2]|0; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $18 = (_generate_a($a,$seed,$17)|0); //@line 376 "LatticeCrypto_v1.0/kex.c"
  $Status = $18; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $19 = $Status; //@line 377 "LatticeCrypto_v1.0/kex.c"
  $20 = ($19|0)!=(0); //@line 377 "LatticeCrypto_v1.0/kex.c"
  if (!($20)) {
   $21 = $1; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $22 = $3; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $23 = ((($22)) + 8|0); //@line 381 "LatticeCrypto_v1.0/kex.c"
   $24 = HEAP32[$23>>2]|0; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $25 = (_get_error($21,$error_seed,0,$24)|0); //@line 381 "LatticeCrypto_v1.0/kex.c"
   $Status = $25; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $26 = $Status; //@line 382 "LatticeCrypto_v1.0/kex.c"
   $27 = ($26|0)!=(0); //@line 382 "LatticeCrypto_v1.0/kex.c"
   if (!($27)) {
    $28 = $3; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $29 = ((($28)) + 8|0); //@line 385 "LatticeCrypto_v1.0/kex.c"
    $30 = HEAP32[$29>>2]|0; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $31 = (_get_error($e,$error_seed,1,$30)|0); //@line 385 "LatticeCrypto_v1.0/kex.c"
    $Status = $31; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $32 = $Status; //@line 386 "LatticeCrypto_v1.0/kex.c"
    $33 = ($32|0)!=(0); //@line 386 "LatticeCrypto_v1.0/kex.c"
    if (!($33)) {
     $34 = $1; //@line 389 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($34,36,1024); //@line 389 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($e,36,1024); //@line 390 "LatticeCrypto_v1.0/kex.c"
     _smul($e,3,1024); //@line 391 "LatticeCrypto_v1.0/kex.c"
     $35 = $1; //@line 393 "LatticeCrypto_v1.0/kex.c"
     _pmuladd($a,$35,$e,$a,1024); //@line 393 "LatticeCrypto_v1.0/kex.c"
     _correction($a,12289,1024); //@line 394 "LatticeCrypto_v1.0/kex.c"
     $36 = $2; //@line 395 "LatticeCrypto_v1.0/kex.c"
     _encode_A($a,$seed,$36); //@line 395 "LatticeCrypto_v1.0/kex.c"
    }
   }
  }
 }
 _clear_words($e,1024); //@line 398 "LatticeCrypto_v1.0/kex.c"
 _clear_words($error_seed,8); //@line 399 "LatticeCrypto_v1.0/kex.c"
 $37 = $Status; //@line 401 "LatticeCrypto_v1.0/kex.c"
 $0 = $37; //@line 401 "LatticeCrypto_v1.0/kex.c"
 $38 = $0; //@line 402 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($38|0); //@line 402 "LatticeCrypto_v1.0/kex.c"
}
function _SecretAgreement_B($PublicKeyA,$SharedSecretB,$PublicKeyB,$pLatticeCrypto) {
 $PublicKeyA = $PublicKeyA|0;
 $SharedSecretB = $SharedSecretB|0;
 $PublicKeyB = $PublicKeyB|0;
 $pLatticeCrypto = $pLatticeCrypto|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $Status = 0, $a = 0, $e = 0, $error_seed = 0, $pk_A = 0, $r = 0, $seed = 0, $sk_B = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 24672|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $pk_A = sp + 20488|0;
 $a = sp + 16392|0;
 $v = sp + 12296|0;
 $r = sp + 8200|0;
 $sk_B = sp + 4104|0;
 $e = sp + 8|0;
 $seed = sp + 24632|0;
 $error_seed = sp + 24600|0;
 $0 = $PublicKeyA;
 $1 = $SharedSecretB;
 $2 = $PublicKeyB;
 $3 = $pLatticeCrypto;
 $Status = 3; //@line 416 "LatticeCrypto_v1.0/kex.c"
 $4 = $0; //@line 418 "LatticeCrypto_v1.0/kex.c"
 _decode_A($4,$pk_A,$seed); //@line 418 "LatticeCrypto_v1.0/kex.c"
 $5 = $3; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $6 = HEAP32[$5>>2]|0; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $7 = (_random_bytes(32,$error_seed,$6)|0); //@line 419 "LatticeCrypto_v1.0/kex.c"
 $Status = $7; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $8 = $Status; //@line 420 "LatticeCrypto_v1.0/kex.c"
 $9 = ($8|0)!=(0); //@line 420 "LatticeCrypto_v1.0/kex.c"
 if (!($9)) {
  $10 = $3; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $11 = ((($10)) + 4|0); //@line 424 "LatticeCrypto_v1.0/kex.c"
  $12 = HEAP32[$11>>2]|0; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $13 = (_generate_a($a,$seed,$12)|0); //@line 424 "LatticeCrypto_v1.0/kex.c"
  $Status = $13; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $14 = $Status; //@line 425 "LatticeCrypto_v1.0/kex.c"
  $15 = ($14|0)!=(0); //@line 425 "LatticeCrypto_v1.0/kex.c"
  if (!($15)) {
   $16 = $3; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $17 = ((($16)) + 8|0); //@line 429 "LatticeCrypto_v1.0/kex.c"
   $18 = HEAP32[$17>>2]|0; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $19 = (_get_error($sk_B,$error_seed,0,$18)|0); //@line 429 "LatticeCrypto_v1.0/kex.c"
   $Status = $19; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $20 = $Status; //@line 430 "LatticeCrypto_v1.0/kex.c"
   $21 = ($20|0)!=(0); //@line 430 "LatticeCrypto_v1.0/kex.c"
   if (!($21)) {
    $22 = $3; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $23 = ((($22)) + 8|0); //@line 433 "LatticeCrypto_v1.0/kex.c"
    $24 = HEAP32[$23>>2]|0; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $25 = (_get_error($e,$error_seed,1,$24)|0); //@line 433 "LatticeCrypto_v1.0/kex.c"
    $Status = $25; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $26 = $Status; //@line 434 "LatticeCrypto_v1.0/kex.c"
    $27 = ($26|0)!=(0); //@line 434 "LatticeCrypto_v1.0/kex.c"
    if (!($27)) {
     _NTT_CT_std2rev_12289($sk_B,36,1024); //@line 437 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($e,36,1024); //@line 438 "LatticeCrypto_v1.0/kex.c"
     _smul($e,3,1024); //@line 439 "LatticeCrypto_v1.0/kex.c"
     _pmuladd($a,$sk_B,$e,$a,1024); //@line 441 "LatticeCrypto_v1.0/kex.c"
     _correction($a,12289,1024); //@line 442 "LatticeCrypto_v1.0/kex.c"
     $28 = $3; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $29 = ((($28)) + 8|0); //@line 444 "LatticeCrypto_v1.0/kex.c"
     $30 = HEAP32[$29>>2]|0; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $31 = (_get_error($e,$error_seed,2,$30)|0); //@line 444 "LatticeCrypto_v1.0/kex.c"
     $Status = $31; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $32 = $Status; //@line 445 "LatticeCrypto_v1.0/kex.c"
     $33 = ($32|0)!=(0); //@line 445 "LatticeCrypto_v1.0/kex.c"
     if (!($33)) {
      _NTT_CT_std2rev_12289($e,36,1024); //@line 448 "LatticeCrypto_v1.0/kex.c"
      _smul($e,81,1024); //@line 449 "LatticeCrypto_v1.0/kex.c"
      _pmuladd($pk_A,$sk_B,$e,$v,1024); //@line 451 "LatticeCrypto_v1.0/kex.c"
      $34 = HEAP32[32>>2]|0; //@line 452 "LatticeCrypto_v1.0/kex.c"
      $35 = HEAP32[28>>2]|0; //@line 452 "LatticeCrypto_v1.0/kex.c"
      _INTT_GS_rev2std_12289($v,4132,$34,$35,1024); //@line 452 "LatticeCrypto_v1.0/kex.c"
      _two_reduce12289($v,1024); //@line 453 "LatticeCrypto_v1.0/kex.c"
      _correction($v,12289,1024); //@line 455 "LatticeCrypto_v1.0/kex.c"
      $36 = $3; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $37 = ((($36)) + 8|0); //@line 458 "LatticeCrypto_v1.0/kex.c"
      $38 = HEAP32[$37>>2]|0; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $39 = (_HelpRec($v,$r,$error_seed,3,$38)|0); //@line 458 "LatticeCrypto_v1.0/kex.c"
      $Status = $39; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $40 = $Status; //@line 459 "LatticeCrypto_v1.0/kex.c"
      $41 = ($40|0)!=(0); //@line 459 "LatticeCrypto_v1.0/kex.c"
      if (!($41)) {
       $42 = $1; //@line 462 "LatticeCrypto_v1.0/kex.c"
       _Rec($v,$r,$42); //@line 462 "LatticeCrypto_v1.0/kex.c"
       $43 = $2; //@line 463 "LatticeCrypto_v1.0/kex.c"
       _encode_B($a,$r,$43); //@line 463 "LatticeCrypto_v1.0/kex.c"
      }
     }
    }
   }
  }
 }
 _clear_words($sk_B,1024); //@line 466 "LatticeCrypto_v1.0/kex.c"
 _clear_words($e,1024); //@line 467 "LatticeCrypto_v1.0/kex.c"
 _clear_words($error_seed,8); //@line 468 "LatticeCrypto_v1.0/kex.c"
 _clear_words($a,1024); //@line 469 "LatticeCrypto_v1.0/kex.c"
 _clear_words($v,1024); //@line 470 "LatticeCrypto_v1.0/kex.c"
 _clear_words($r,1024); //@line 471 "LatticeCrypto_v1.0/kex.c"
 $44 = $Status; //@line 473 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($44|0); //@line 473 "LatticeCrypto_v1.0/kex.c"
}
function _SecretAgreement_A($PublicKeyB,$SecretKeyA,$SharedSecretA) {
 $PublicKeyB = $PublicKeyB|0;
 $SecretKeyA = $SecretKeyA|0;
 $SharedSecretA = $SharedSecretA|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $Status = 0, $r = 0, $u = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 8224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $u = sp + 4104|0;
 $r = sp + 8|0;
 $0 = $PublicKeyB;
 $1 = $SecretKeyA;
 $2 = $SharedSecretA;
 $Status = 0; //@line 485 "LatticeCrypto_v1.0/kex.c"
 $3 = $0; //@line 487 "LatticeCrypto_v1.0/kex.c"
 _decode_B($3,$u,$r); //@line 487 "LatticeCrypto_v1.0/kex.c"
 $4 = $1; //@line 489 "LatticeCrypto_v1.0/kex.c"
 _pmul($4,$u,$u,1024); //@line 489 "LatticeCrypto_v1.0/kex.c"
 $5 = HEAP32[32>>2]|0; //@line 490 "LatticeCrypto_v1.0/kex.c"
 $6 = HEAP32[28>>2]|0; //@line 490 "LatticeCrypto_v1.0/kex.c"
 _INTT_GS_rev2std_12289($u,4132,$5,$6,1024); //@line 490 "LatticeCrypto_v1.0/kex.c"
 _two_reduce12289($u,1024); //@line 491 "LatticeCrypto_v1.0/kex.c"
 _correction($u,12289,1024); //@line 493 "LatticeCrypto_v1.0/kex.c"
 $7 = $2; //@line 496 "LatticeCrypto_v1.0/kex.c"
 _Rec($u,$r,$7); //@line 496 "LatticeCrypto_v1.0/kex.c"
 _clear_words($u,1024); //@line 499 "LatticeCrypto_v1.0/kex.c"
 _clear_words($r,1024); //@line 500 "LatticeCrypto_v1.0/kex.c"
 $8 = $Status; //@line 502 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($8|0); //@line 502 "LatticeCrypto_v1.0/kex.c"
}
function _Abs($value) {
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $mask = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 $1 = $0; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $2 = $1 >> 31; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $mask = $2; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $3 = $mask; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $4 = $0; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $5 = $3 ^ $4; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $6 = $mask; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $7 = (($5) - ($6))|0; //@line 203 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($7|0); //@line 203 "LatticeCrypto_v1.0/kex.c"
}
function _LDDecode($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $cneg = 0, $i = 0;
 var $mask1 = 0, $mask2 = 0, $norm = 0, $value = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $norm = 0; //@line 264 "LatticeCrypto_v1.0/kex.c"
 $cneg = -98312; //@line 266 "LatticeCrypto_v1.0/kex.c"
 $i = 0; //@line 268 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $1 = $i; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $2 = ($1>>>0)<(4); //@line 268 "LatticeCrypto_v1.0/kex.c"
  if (!($2)) {
   break;
  }
  $3 = $i; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $4 = $0; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $5 = (($4) + ($3<<2)|0); //@line 269 "LatticeCrypto_v1.0/kex.c"
  $6 = HEAP32[$5>>2]|0; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $7 = $6 >> 31; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $mask1 = $7; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $8 = $i; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $9 = $0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $10 = (($9) + ($8<<2)|0); //@line 270 "LatticeCrypto_v1.0/kex.c"
  $11 = HEAP32[$10>>2]|0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $12 = (_Abs($11)|0); //@line 270 "LatticeCrypto_v1.0/kex.c"
  $13 = (49156 - ($12))|0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $14 = $13 >> 31; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $mask2 = $14; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $15 = $mask1; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $16 = $cneg; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $17 = 98312 ^ $16; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $18 = $15 & $17; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $19 = $cneg; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $20 = $18 ^ $19; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $value = $20; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $21 = $i; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $22 = $0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + ($21<<2)|0); //@line 273 "LatticeCrypto_v1.0/kex.c"
  $24 = HEAP32[$23>>2]|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $25 = $mask2; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $26 = $value; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $27 = $25 & $26; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $28 = (($24) + ($27))|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $29 = (_Abs($28)|0); //@line 273 "LatticeCrypto_v1.0/kex.c"
  $30 = $norm; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + ($29))|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $norm = $31; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $32 = $i; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + 1)|0; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $i = $33; //@line 268 "LatticeCrypto_v1.0/kex.c"
 }
 $34 = $norm; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $35 = (98312 - ($34))|0; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $36 = $35 >>> 31; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $37 = $36 ^ 1; //@line 276 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($37|0); //@line 276 "LatticeCrypto_v1.0/kex.c"
}
function _random_bytes($nbytes,$random_array,$RandomBytesFunction) {
 $nbytes = $nbytes|0;
 $random_array = $random_array|0;
 $RandomBytesFunction = $RandomBytesFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $nbytes;
 $2 = $random_array;
 $3 = $RandomBytesFunction;
 $4 = $2; //@line 20 "LatticeCrypto_v1.0/random.c"
 $5 = ($4|0)==(0|0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $6 = $3;
 $7 = ($6|0)==(0|0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $or$cond = $5 | $7; //@line 20 "LatticeCrypto_v1.0/random.c"
 $8 = $1;
 $9 = ($8|0)==(0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $9; //@line 20 "LatticeCrypto_v1.0/random.c"
 if ($or$cond3) {
  $0 = 6; //@line 21 "LatticeCrypto_v1.0/random.c"
  $14 = $0; //@line 25 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($14|0); //@line 25 "LatticeCrypto_v1.0/random.c"
 } else {
  $10 = $3; //@line 24 "LatticeCrypto_v1.0/random.c"
  $11 = $1; //@line 24 "LatticeCrypto_v1.0/random.c"
  $12 = $2; //@line 24 "LatticeCrypto_v1.0/random.c"
  $13 = (FUNCTION_TABLE_iii[$10 & 31]($11,$12)|0); //@line 24 "LatticeCrypto_v1.0/random.c"
  $0 = $13; //@line 24 "LatticeCrypto_v1.0/random.c"
  $14 = $0; //@line 25 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($14|0); //@line 25 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _extended_output($seed,$seed_nbytes,$array_ndigits,$extended_array,$ExtendableOutputFunction) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $array_ndigits = $array_ndigits|0;
 $extended_array = $extended_array|0;
 $ExtendableOutputFunction = $ExtendableOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $array_ndigits;
 $4 = $extended_array;
 $5 = $ExtendableOutputFunction;
 $6 = $1; //@line 33 "LatticeCrypto_v1.0/random.c"
 $7 = ($6|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $8 = $4;
 $9 = ($8|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond = $7 | $9; //@line 33 "LatticeCrypto_v1.0/random.c"
 $10 = $5;
 $11 = ($10|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $11; //@line 33 "LatticeCrypto_v1.0/random.c"
 $12 = $2;
 $13 = ($12|0)==(0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond5 = $or$cond3 | $13; //@line 33 "LatticeCrypto_v1.0/random.c"
 $14 = $3;
 $15 = ($14|0)==(0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond7 = $or$cond5 | $15; //@line 33 "LatticeCrypto_v1.0/random.c"
 if ($or$cond7) {
  $0 = 6; //@line 34 "LatticeCrypto_v1.0/random.c"
  $22 = $0; //@line 38 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($22|0); //@line 38 "LatticeCrypto_v1.0/random.c"
 } else {
  $16 = $5; //@line 37 "LatticeCrypto_v1.0/random.c"
  $17 = $1; //@line 37 "LatticeCrypto_v1.0/random.c"
  $18 = $2; //@line 37 "LatticeCrypto_v1.0/random.c"
  $19 = $3; //@line 37 "LatticeCrypto_v1.0/random.c"
  $20 = $4; //@line 37 "LatticeCrypto_v1.0/random.c"
  $21 = (FUNCTION_TABLE_iiiii[$16 & 31]($17,$18,$19,$20)|0); //@line 37 "LatticeCrypto_v1.0/random.c"
  $0 = $21; //@line 37 "LatticeCrypto_v1.0/random.c"
  $22 = $0; //@line 38 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($22|0); //@line 38 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _stream_output($seed,$seed_nbytes,$nonce,$nonce_nbytes,$array_nbytes,$stream_array,$StreamOutputFunction) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $nonce = $nonce|0;
 $nonce_nbytes = $nonce_nbytes|0;
 $array_nbytes = $array_nbytes|0;
 $stream_array = $stream_array|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, $or$cond9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $nonce;
 $4 = $nonce_nbytes;
 $5 = $array_nbytes;
 $6 = $stream_array;
 $7 = $StreamOutputFunction;
 $8 = $1; //@line 46 "LatticeCrypto_v1.0/random.c"
 $9 = ($8|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $10 = $6;
 $11 = ($10|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond = $9 | $11; //@line 46 "LatticeCrypto_v1.0/random.c"
 $12 = $7;
 $13 = ($12|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $13; //@line 46 "LatticeCrypto_v1.0/random.c"
 $14 = $2;
 $15 = ($14|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond5 = $or$cond3 | $15; //@line 46 "LatticeCrypto_v1.0/random.c"
 $16 = $4;
 $17 = ($16|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond7 = $or$cond5 | $17; //@line 46 "LatticeCrypto_v1.0/random.c"
 $18 = $5;
 $19 = ($18|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond9 = $or$cond7 | $19; //@line 46 "LatticeCrypto_v1.0/random.c"
 if ($or$cond9) {
  $0 = 6; //@line 47 "LatticeCrypto_v1.0/random.c"
  $28 = $0; //@line 51 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($28|0); //@line 51 "LatticeCrypto_v1.0/random.c"
 } else {
  $20 = $7; //@line 50 "LatticeCrypto_v1.0/random.c"
  $21 = $1; //@line 50 "LatticeCrypto_v1.0/random.c"
  $22 = $2; //@line 50 "LatticeCrypto_v1.0/random.c"
  $23 = $3; //@line 50 "LatticeCrypto_v1.0/random.c"
  $24 = $4; //@line 50 "LatticeCrypto_v1.0/random.c"
  $25 = $5; //@line 50 "LatticeCrypto_v1.0/random.c"
  $26 = $6; //@line 50 "LatticeCrypto_v1.0/random.c"
  $27 = (FUNCTION_TABLE_iiiiiii[$20 & 31]($21,$22,$23,$24,$25,$26)|0); //@line 50 "LatticeCrypto_v1.0/random.c"
  $0 = $27; //@line 50 "LatticeCrypto_v1.0/random.c"
  $28 = $0; //@line 51 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($28|0); //@line 51 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _rlwejs_randombytes($nbytes,$random_array) {
 $nbytes = $nbytes|0;
 $random_array = $random_array|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $nbytes;
 $1 = $random_array;
 $2 = $1; //@line 18 "rlwe.c"
 $3 = $0; //@line 18 "rlwe.c"
 _randombytes_buf($2,$3); //@line 18 "rlwe.c"
 STACKTOP = sp;return 0; //@line 19 "rlwe.c"
}
function _rlwejs_streamoutput($seed,$seed_nbytes,$nonce,$nonce_nbytes,$array_nbytes,$stream_array) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $nonce = $nonce|0;
 $nonce_nbytes = $nonce_nbytes|0;
 $array_nbytes = $array_nbytes|0;
 $stream_array = $stream_array|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $k = 0, $n = 0, $status = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $nonce;
 $4 = $nonce_nbytes;
 $5 = $array_nbytes;
 $6 = $stream_array;
 $7 = $1; //@line 30 "rlwe.c"
 $k = $7; //@line 30 "rlwe.c"
 $8 = $2; //@line 31 "rlwe.c"
 $9 = ($8>>>0)<(32); //@line 31 "rlwe.c"
 if ($9) {
  $10 = (_calloc(32,1)|0); //@line 32 "rlwe.c"
  $k = $10; //@line 32 "rlwe.c"
  $11 = $2; //@line 33 "rlwe.c"
  $12 = ($11>>>0)>(0); //@line 33 "rlwe.c"
  if ($12) {
   $13 = $k; //@line 34 "rlwe.c"
   $14 = $1; //@line 34 "rlwe.c"
   $15 = $2; //@line 34 "rlwe.c"
   _memcpy(($13|0),($14|0),($15|0))|0; //@line 34 "rlwe.c"
  }
 }
 $16 = $3; //@line 38 "rlwe.c"
 $n = $16; //@line 38 "rlwe.c"
 $17 = $4; //@line 39 "rlwe.c"
 $18 = ($17>>>0)<(8); //@line 39 "rlwe.c"
 if ($18) {
  $19 = (_calloc(8,1)|0); //@line 40 "rlwe.c"
  $n = $19; //@line 40 "rlwe.c"
  $20 = $4; //@line 41 "rlwe.c"
  $21 = ($20>>>0)>(0); //@line 41 "rlwe.c"
  if ($21) {
   $22 = $n; //@line 42 "rlwe.c"
   $23 = $3; //@line 42 "rlwe.c"
   $24 = $4; //@line 42 "rlwe.c"
   _memcpy(($22|0),($23|0),($24|0))|0; //@line 42 "rlwe.c"
  }
 }
 $25 = $6; //@line 46 "rlwe.c"
 $26 = $5; //@line 46 "rlwe.c"
 $27 = $n; //@line 46 "rlwe.c"
 $28 = $k; //@line 46 "rlwe.c"
 $29 = (_crypto_stream_chacha20($25,$26,0,$27,$28)|0); //@line 46 "rlwe.c"
 $status = $29; //@line 46 "rlwe.c"
 $30 = $k; //@line 48 "rlwe.c"
 $31 = $1; //@line 48 "rlwe.c"
 $32 = ($30|0)!=($31|0); //@line 48 "rlwe.c"
 if ($32) {
  $33 = $k; //@line 49 "rlwe.c"
  _sodium_memzero($33,32); //@line 49 "rlwe.c"
  $34 = $k; //@line 50 "rlwe.c"
  _free($34); //@line 50 "rlwe.c"
 }
 $35 = $n; //@line 53 "rlwe.c"
 $36 = $3; //@line 53 "rlwe.c"
 $37 = ($35|0)!=($36|0); //@line 53 "rlwe.c"
 if ($37) {
  $38 = $n; //@line 54 "rlwe.c"
  _sodium_memzero($38,8); //@line 54 "rlwe.c"
  $39 = $n; //@line 55 "rlwe.c"
  _free($39); //@line 55 "rlwe.c"
 }
 $40 = $status; //@line 58 "rlwe.c"
 $41 = ($40|0)!=(0); //@line 58 "rlwe.c"
 if ($41) {
  $0 = 3; //@line 59 "rlwe.c"
  $42 = $0; //@line 63 "rlwe.c"
  STACKTOP = sp;return ($42|0); //@line 63 "rlwe.c"
 } else {
  $0 = 0; //@line 62 "rlwe.c"
  $42 = $0; //@line 63 "rlwe.c"
  STACKTOP = sp;return ($42|0); //@line 63 "rlwe.c"
 }
 return (0)|0;
}
function _rlwejs_extendableoutput($seed,$seed_nbytes,$array_ndigits,$extended_array) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $array_ndigits = $array_ndigits|0;
 $extended_array = $extended_array|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $status = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $array_ndigits;
 $4 = $extended_array;
 $5 = $1; //@line 72 "rlwe.c"
 $6 = $2; //@line 73 "rlwe.c"
 $7 = $3; //@line 76 "rlwe.c"
 $8 = $7<<2; //@line 76 "rlwe.c"
 $9 = $4; //@line 77 "rlwe.c"
 $10 = (_rlwejs_streamoutput($5,$6,0,0,$8,$9)|0); //@line 71 "rlwe.c"
 $status = $10; //@line 71 "rlwe.c"
 $11 = $status; //@line 80 "rlwe.c"
 $12 = ($11|0)!=(0); //@line 80 "rlwe.c"
 if ($12) {
  $13 = $status; //@line 81 "rlwe.c"
  $0 = $13; //@line 81 "rlwe.c"
  $27 = $0; //@line 89 "rlwe.c"
  STACKTOP = sp;return ($27|0); //@line 89 "rlwe.c"
 }
 $i = 0; //@line 84 "rlwe.c"
 while(1) {
  $14 = $i; //@line 84 "rlwe.c"
  $15 = $3; //@line 84 "rlwe.c"
  $16 = ($14>>>0)<($15>>>0); //@line 84 "rlwe.c"
  if (!($16)) {
   break;
  }
  $17 = $i; //@line 85 "rlwe.c"
  $18 = $4; //@line 85 "rlwe.c"
  $19 = (($18) + ($17<<2)|0); //@line 85 "rlwe.c"
  $20 = HEAP32[$19>>2]|0; //@line 85 "rlwe.c"
  $21 = (($20>>>0) % 12289)&-1; //@line 85 "rlwe.c"
  $22 = $i; //@line 85 "rlwe.c"
  $23 = $4; //@line 85 "rlwe.c"
  $24 = (($23) + ($22<<2)|0); //@line 85 "rlwe.c"
  HEAP32[$24>>2] = $21; //@line 85 "rlwe.c"
  $25 = $i; //@line 84 "rlwe.c"
  $26 = (($25) + 1)|0; //@line 84 "rlwe.c"
  $i = $26; //@line 84 "rlwe.c"
 }
 $0 = 0; //@line 88 "rlwe.c"
 $27 = $0; //@line 89 "rlwe.c"
 STACKTOP = sp;return ($27|0); //@line 89 "rlwe.c"
}
function _rlwejs_init() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _randombytes_stir(); //@line 92 "rlwe.c"
 $0 = (_LatticeCrypto_allocate()|0); //@line 94 "rlwe.c"
 HEAP32[8236>>2] = $0; //@line 94 "rlwe.c"
 $1 = HEAP32[8236>>2]|0; //@line 97 "rlwe.c"
 $2 = (_LatticeCrypto_initialize($1,18,18,18)|0); //@line 96 "rlwe.c"
 return ($2|0); //@line 96 "rlwe.c"
}
function _rlwejs_public_key_bytes() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[8228>>2]|0; //@line 105 "rlwe.c"
 $1 = (($0) + 1)|0; //@line 105 "rlwe.c"
 return ($1|0); //@line 105 "rlwe.c"
}
function _rlwejs_private_key_bytes() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[8232>>2]|0; //@line 109 "rlwe.c"
 $1 = (($0) + 1)|0; //@line 109 "rlwe.c"
 $2 = $1<<2; //@line 109 "rlwe.c"
 return ($2|0); //@line 109 "rlwe.c"
}
function _rlwejs_secret_bytes() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 32; //@line 113 "rlwe.c"
}
function _rlwejs_keypair_alice($public_key,$private_key) {
 $public_key = $public_key|0;
 $private_key = $private_key|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $status = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $public_key;
 $1 = $private_key;
 $2 = $1; //@line 120 "rlwe.c"
 $3 = $0; //@line 120 "rlwe.c"
 $4 = HEAP32[8236>>2]|0; //@line 120 "rlwe.c"
 $5 = (_KeyGeneration_A($2,$3,$4)|0); //@line 120 "rlwe.c"
 $status = $5; //@line 120 "rlwe.c"
 $6 = HEAP32[8228>>2]|0; //@line 122 "rlwe.c"
 $7 = $0; //@line 122 "rlwe.c"
 $8 = (($7) + ($6)|0); //@line 122 "rlwe.c"
 HEAP8[$8>>0] = 1; //@line 122 "rlwe.c"
 $9 = HEAP32[8232>>2]|0; //@line 123 "rlwe.c"
 $10 = $1; //@line 123 "rlwe.c"
 $11 = (($10) + ($9<<2)|0); //@line 123 "rlwe.c"
 HEAP32[$11>>2] = 1; //@line 123 "rlwe.c"
 $12 = $status; //@line 125 "rlwe.c"
 STACKTOP = sp;return ($12|0); //@line 125 "rlwe.c"
}
function _rlwejs_secret_alice($public_key,$private_key,$secret) {
 $public_key = $public_key|0;
 $private_key = $private_key|0;
 $secret = $secret|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $public_key;
 $2 = $private_key;
 $3 = $secret;
 $4 = HEAP32[8228>>2]|0; //@line 133 "rlwe.c"
 $5 = $1; //@line 133 "rlwe.c"
 $6 = (($5) + ($4)|0); //@line 133 "rlwe.c"
 $7 = HEAP8[$6>>0]|0; //@line 133 "rlwe.c"
 $8 = $7&255; //@line 133 "rlwe.c"
 $9 = ($8|0)!=(0); //@line 133 "rlwe.c"
 if (!($9)) {
  $10 = HEAP32[8232>>2]|0; //@line 133 "rlwe.c"
  $11 = $2; //@line 133 "rlwe.c"
  $12 = (($11) + ($10<<2)|0); //@line 133 "rlwe.c"
  $13 = HEAP32[$12>>2]|0; //@line 133 "rlwe.c"
  $14 = ($13|0)!=(0); //@line 133 "rlwe.c"
  if ($14) {
   $15 = $1; //@line 137 "rlwe.c"
   $16 = $2; //@line 137 "rlwe.c"
   $17 = $3; //@line 137 "rlwe.c"
   $18 = (_SecretAgreement_A($15,$16,$17)|0); //@line 137 "rlwe.c"
   $0 = $18; //@line 137 "rlwe.c"
   $19 = $0; //@line 138 "rlwe.c"
   STACKTOP = sp;return ($19|0); //@line 138 "rlwe.c"
  }
 }
 $0 = 6; //@line 134 "rlwe.c"
 $19 = $0; //@line 138 "rlwe.c"
 STACKTOP = sp;return ($19|0); //@line 138 "rlwe.c"
}
function _rlwejs_secret_bob($public_key_alice,$public_key_bob,$secret) {
 $public_key_alice = $public_key_alice|0;
 $public_key_bob = $public_key_bob|0;
 $secret = $secret|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $status = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $public_key_alice;
 $2 = $public_key_bob;
 $3 = $secret;
 $4 = HEAP32[8228>>2]|0; //@line 145 "rlwe.c"
 $5 = $1; //@line 145 "rlwe.c"
 $6 = (($5) + ($4)|0); //@line 145 "rlwe.c"
 $7 = HEAP8[$6>>0]|0; //@line 145 "rlwe.c"
 $8 = ($7<<24>>24)!=(0); //@line 145 "rlwe.c"
 if ($8) {
  $9 = $1; //@line 149 "rlwe.c"
  $10 = $3; //@line 149 "rlwe.c"
  $11 = $2; //@line 149 "rlwe.c"
  $12 = HEAP32[8236>>2]|0; //@line 149 "rlwe.c"
  $13 = (_SecretAgreement_B($9,$10,$11,$12)|0); //@line 149 "rlwe.c"
  $status = $13; //@line 149 "rlwe.c"
  $14 = HEAP32[8228>>2]|0; //@line 151 "rlwe.c"
  $15 = $2; //@line 151 "rlwe.c"
  $16 = (($15) + ($14)|0); //@line 151 "rlwe.c"
  HEAP8[$16>>0] = 0; //@line 151 "rlwe.c"
  $17 = $status; //@line 153 "rlwe.c"
  $0 = $17; //@line 153 "rlwe.c"
  $18 = $0; //@line 154 "rlwe.c"
  STACKTOP = sp;return ($18|0); //@line 154 "rlwe.c"
 } else {
  $0 = 6; //@line 146 "rlwe.c"
  $18 = $0; //@line 154 "rlwe.c"
  STACKTOP = sp;return ($18|0); //@line 154 "rlwe.c"
 }
 return (0)|0;
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[8240>>2]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 8284;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 60|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$3$i = 0, $$lcssa = 0, $$lcssa211 = 0, $$lcssa215 = 0, $$lcssa216 = 0, $$lcssa217 = 0, $$lcssa219 = 0, $$lcssa222 = 0, $$lcssa224 = 0, $$lcssa226 = 0, $$lcssa228 = 0, $$lcssa230 = 0, $$lcssa232 = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i22$i = 0, $$pre$i25 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i23$iZ2D = 0;
 var $$pre$phi$i26Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi58$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre105 = 0, $$pre106 = 0, $$pre14$i$i = 0, $$pre43$i = 0, $$pre56$i$i = 0, $$pre57$i$i = 0, $$pre8$i = 0, $$rsize$0$i = 0, $$rsize$3$i = 0, $$sum = 0, $$sum$i$i = 0, $$sum$i$i$i = 0, $$sum$i13$i = 0, $$sum$i14$i = 0, $$sum$i17$i = 0, $$sum$i19$i = 0;
 var $$sum$i2334 = 0, $$sum$i32 = 0, $$sum$i35 = 0, $$sum1 = 0, $$sum1$i = 0, $$sum1$i$i = 0, $$sum1$i15$i = 0, $$sum1$i20$i = 0, $$sum1$i24 = 0, $$sum10 = 0, $$sum10$i = 0, $$sum10$i$i = 0, $$sum11$i = 0, $$sum11$i$i = 0, $$sum1112 = 0, $$sum112$i = 0, $$sum113$i = 0, $$sum114$i = 0, $$sum115$i = 0, $$sum116$i = 0;
 var $$sum117$i = 0, $$sum118$i = 0, $$sum119$i = 0, $$sum12$i = 0, $$sum12$i$i = 0, $$sum120$i = 0, $$sum121$i = 0, $$sum122$i = 0, $$sum123$i = 0, $$sum124$i = 0, $$sum125$i = 0, $$sum13$i = 0, $$sum13$i$i = 0, $$sum14$i$i = 0, $$sum15$i = 0, $$sum15$i$i = 0, $$sum16$i = 0, $$sum16$i$i = 0, $$sum17$i = 0, $$sum17$i$i = 0;
 var $$sum18$i = 0, $$sum1819$i$i = 0, $$sum2 = 0, $$sum2$i = 0, $$sum2$i$i = 0, $$sum2$i$i$i = 0, $$sum2$i16$i = 0, $$sum2$i18$i = 0, $$sum2$i21$i = 0, $$sum20$i$i = 0, $$sum21$i$i = 0, $$sum22$i$i = 0, $$sum23$i$i = 0, $$sum24$i$i = 0, $$sum25$i$i = 0, $$sum27$i$i = 0, $$sum28$i$i = 0, $$sum29$i$i = 0, $$sum3$i = 0, $$sum3$i27 = 0;
 var $$sum30$i$i = 0, $$sum3132$i$i = 0, $$sum34$i$i = 0, $$sum3536$i$i = 0, $$sum3738$i$i = 0, $$sum39$i$i = 0, $$sum4 = 0, $$sum4$i = 0, $$sum4$i$i = 0, $$sum4$i28 = 0, $$sum40$i$i = 0, $$sum41$i$i = 0, $$sum42$i$i = 0, $$sum5$i = 0, $$sum5$i$i = 0, $$sum56 = 0, $$sum6$i = 0, $$sum67$i$i = 0, $$sum7$i = 0, $$sum8$i = 0;
 var $$sum9 = 0, $$sum9$i = 0, $$sum9$i$i = 0, $$tsize$1$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0;
 var $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0;
 var $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0;
 var $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0;
 var $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0;
 var $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0;
 var $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0;
 var $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0;
 var $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0;
 var $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0;
 var $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0;
 var $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0;
 var $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0;
 var $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0;
 var $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0;
 var $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0;
 var $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0;
 var $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0;
 var $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0;
 var $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0;
 var $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0;
 var $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0;
 var $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0;
 var $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0;
 var $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0;
 var $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0;
 var $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0;
 var $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0;
 var $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0;
 var $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0;
 var $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0;
 var $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0;
 var $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0;
 var $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0;
 var $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0;
 var $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0;
 var $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0;
 var $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0;
 var $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0;
 var $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0;
 var $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0;
 var $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0;
 var $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0;
 var $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0;
 var $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0;
 var $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0;
 var $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0;
 var $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0;
 var $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0;
 var $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0;
 var $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0;
 var $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0;
 var $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0;
 var $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0;
 var $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$029$i = 0, $K2$07$i$i = 0, $K8$051$i$i = 0, $R$0$i = 0, $R$0$i$i = 0, $R$0$i$i$lcssa = 0, $R$0$i$lcssa = 0, $R$0$i18 = 0, $R$0$i18$lcssa = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i20 = 0, $RP$0$i = 0, $RP$0$i$i = 0, $RP$0$i$i$lcssa = 0, $RP$0$i$lcssa = 0;
 var $RP$0$i17 = 0, $RP$0$i17$lcssa = 0, $T$0$lcssa$i = 0, $T$0$lcssa$i$i = 0, $T$0$lcssa$i25$i = 0, $T$028$i = 0, $T$028$i$lcssa = 0, $T$050$i$i = 0, $T$050$i$i$lcssa = 0, $T$06$i$i = 0, $T$06$i$i$lcssa = 0, $br$0$ph$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i21 = 0, $exitcond$i$i = 0, $i$02$i$i = 0, $idx$0$i = 0, $mem$0 = 0, $nb$0 = 0;
 var $not$$i = 0, $not$$i$i = 0, $not$$i26$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0, $or$cond$i30 = 0, $or$cond1$i = 0, $or$cond19$i = 0, $or$cond2$i = 0, $or$cond3$i = 0, $or$cond5$i = 0, $or$cond57$i = 0, $or$cond6$i = 0, $or$cond8$i = 0, $or$cond9$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i15 = 0, $rsize$1$i = 0;
 var $rsize$2$i = 0, $rsize$3$lcssa$i = 0, $rsize$331$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$084$i = 0, $sp$084$i$lcssa = 0, $sp$183$i = 0, $sp$183$i$lcssa = 0, $ssize$0$$i = 0, $ssize$0$i = 0, $ssize$1$ph$i = 0, $ssize$2$i = 0, $t$0$i = 0, $t$0$i14 = 0, $t$1$i = 0, $t$2$ph$i = 0;
 var $t$2$v$3$i = 0, $t$230$i = 0, $tbase$255$i = 0, $tsize$0$ph$i = 0, $tsize$0323944$i = 0, $tsize$1$i = 0, $tsize$254$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i16 = 0, $v$1$i = 0, $v$2$i = 0, $v$3$lcssa$i = 0, $v$3$ph$i = 0, $v$332$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($bytes>>>0)<(245);
 do {
  if ($0) {
   $1 = ($bytes>>>0)<(11);
   $2 = (($bytes) + 11)|0;
   $3 = $2 & -8;
   $4 = $1 ? 16 : $3;
   $5 = $4 >>> 3;
   $6 = HEAP32[8288>>2]|0;
   $7 = $6 >>> $5;
   $8 = $7 & 3;
   $9 = ($8|0)==(0);
   if (!($9)) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = (($11) + ($5))|0;
    $13 = $12 << 1;
    $14 = (8328 + ($13<<2)|0);
    $$sum10 = (($13) + 2)|0;
    $15 = (8328 + ($$sum10<<2)|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($14|0)==($18|0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[8288>>2] = $22;
     } else {
      $23 = HEAP32[(8304)>>2]|0;
      $24 = ($18>>>0)<($23>>>0);
      if ($24) {
       _abort();
       // unreachable;
      }
      $25 = ((($18)) + 12|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = ($26|0)==($16|0);
      if ($27) {
       HEAP32[$25>>2] = $14;
       HEAP32[$15>>2] = $18;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = ((($16)) + 4|0);
    HEAP32[$30>>2] = $29;
    $$sum1112 = $28 | 4;
    $31 = (($16) + ($$sum1112)|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = $32 | 1;
    HEAP32[$31>>2] = $33;
    $mem$0 = $17;
    return ($mem$0|0);
   }
   $34 = HEAP32[(8296)>>2]|0;
   $35 = ($4>>>0)>($34>>>0);
   if ($35) {
    $36 = ($7|0)==(0);
    if (!($36)) {
     $37 = $7 << $5;
     $38 = 2 << $5;
     $39 = (0 - ($38))|0;
     $40 = $38 | $39;
     $41 = $37 & $40;
     $42 = (0 - ($41))|0;
     $43 = $41 & $42;
     $44 = (($43) + -1)|0;
     $45 = $44 >>> 12;
     $46 = $45 & 16;
     $47 = $44 >>> $46;
     $48 = $47 >>> 5;
     $49 = $48 & 8;
     $50 = $49 | $46;
     $51 = $47 >>> $49;
     $52 = $51 >>> 2;
     $53 = $52 & 4;
     $54 = $50 | $53;
     $55 = $51 >>> $53;
     $56 = $55 >>> 1;
     $57 = $56 & 2;
     $58 = $54 | $57;
     $59 = $55 >>> $57;
     $60 = $59 >>> 1;
     $61 = $60 & 1;
     $62 = $58 | $61;
     $63 = $59 >>> $61;
     $64 = (($62) + ($63))|0;
     $65 = $64 << 1;
     $66 = (8328 + ($65<<2)|0);
     $$sum4 = (($65) + 2)|0;
     $67 = (8328 + ($$sum4<<2)|0);
     $68 = HEAP32[$67>>2]|0;
     $69 = ((($68)) + 8|0);
     $70 = HEAP32[$69>>2]|0;
     $71 = ($66|0)==($70|0);
     do {
      if ($71) {
       $72 = 1 << $64;
       $73 = $72 ^ -1;
       $74 = $6 & $73;
       HEAP32[8288>>2] = $74;
       $89 = $34;
      } else {
       $75 = HEAP32[(8304)>>2]|0;
       $76 = ($70>>>0)<($75>>>0);
       if ($76) {
        _abort();
        // unreachable;
       }
       $77 = ((($70)) + 12|0);
       $78 = HEAP32[$77>>2]|0;
       $79 = ($78|0)==($68|0);
       if ($79) {
        HEAP32[$77>>2] = $66;
        HEAP32[$67>>2] = $70;
        $$pre = HEAP32[(8296)>>2]|0;
        $89 = $$pre;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $80 = $64 << 3;
     $81 = (($80) - ($4))|0;
     $82 = $4 | 3;
     $83 = ((($68)) + 4|0);
     HEAP32[$83>>2] = $82;
     $84 = (($68) + ($4)|0);
     $85 = $81 | 1;
     $$sum56 = $4 | 4;
     $86 = (($68) + ($$sum56)|0);
     HEAP32[$86>>2] = $85;
     $87 = (($68) + ($80)|0);
     HEAP32[$87>>2] = $81;
     $88 = ($89|0)==(0);
     if (!($88)) {
      $90 = HEAP32[(8308)>>2]|0;
      $91 = $89 >>> 3;
      $92 = $91 << 1;
      $93 = (8328 + ($92<<2)|0);
      $94 = HEAP32[8288>>2]|0;
      $95 = 1 << $91;
      $96 = $94 & $95;
      $97 = ($96|0)==(0);
      if ($97) {
       $98 = $94 | $95;
       HEAP32[8288>>2] = $98;
       $$pre105 = (($92) + 2)|0;
       $$pre106 = (8328 + ($$pre105<<2)|0);
       $$pre$phiZ2D = $$pre106;$F4$0 = $93;
      } else {
       $$sum9 = (($92) + 2)|0;
       $99 = (8328 + ($$sum9<<2)|0);
       $100 = HEAP32[$99>>2]|0;
       $101 = HEAP32[(8304)>>2]|0;
       $102 = ($100>>>0)<($101>>>0);
       if ($102) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $99;$F4$0 = $100;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $90;
      $103 = ((($F4$0)) + 12|0);
      HEAP32[$103>>2] = $90;
      $104 = ((($90)) + 8|0);
      HEAP32[$104>>2] = $F4$0;
      $105 = ((($90)) + 12|0);
      HEAP32[$105>>2] = $93;
     }
     HEAP32[(8296)>>2] = $81;
     HEAP32[(8308)>>2] = $84;
     $mem$0 = $69;
     return ($mem$0|0);
    }
    $106 = HEAP32[(8292)>>2]|0;
    $107 = ($106|0)==(0);
    if ($107) {
     $nb$0 = $4;
    } else {
     $108 = (0 - ($106))|0;
     $109 = $106 & $108;
     $110 = (($109) + -1)|0;
     $111 = $110 >>> 12;
     $112 = $111 & 16;
     $113 = $110 >>> $112;
     $114 = $113 >>> 5;
     $115 = $114 & 8;
     $116 = $115 | $112;
     $117 = $113 >>> $115;
     $118 = $117 >>> 2;
     $119 = $118 & 4;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = $121 >>> 1;
     $123 = $122 & 2;
     $124 = $120 | $123;
     $125 = $121 >>> $123;
     $126 = $125 >>> 1;
     $127 = $126 & 1;
     $128 = $124 | $127;
     $129 = $125 >>> $127;
     $130 = (($128) + ($129))|0;
     $131 = (8592 + ($130<<2)|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = ((($132)) + 4|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = $134 & -8;
     $136 = (($135) - ($4))|0;
     $rsize$0$i = $136;$t$0$i = $132;$v$0$i = $132;
     while(1) {
      $137 = ((($t$0$i)) + 16|0);
      $138 = HEAP32[$137>>2]|0;
      $139 = ($138|0)==(0|0);
      if ($139) {
       $140 = ((($t$0$i)) + 20|0);
       $141 = HEAP32[$140>>2]|0;
       $142 = ($141|0)==(0|0);
       if ($142) {
        $rsize$0$i$lcssa = $rsize$0$i;$v$0$i$lcssa = $v$0$i;
        break;
       } else {
        $144 = $141;
       }
      } else {
       $144 = $138;
      }
      $143 = ((($144)) + 4|0);
      $145 = HEAP32[$143>>2]|0;
      $146 = $145 & -8;
      $147 = (($146) - ($4))|0;
      $148 = ($147>>>0)<($rsize$0$i>>>0);
      $$rsize$0$i = $148 ? $147 : $rsize$0$i;
      $$v$0$i = $148 ? $144 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;$t$0$i = $144;$v$0$i = $$v$0$i;
     }
     $149 = HEAP32[(8304)>>2]|0;
     $150 = ($v$0$i$lcssa>>>0)<($149>>>0);
     if ($150) {
      _abort();
      // unreachable;
     }
     $151 = (($v$0$i$lcssa) + ($4)|0);
     $152 = ($v$0$i$lcssa>>>0)<($151>>>0);
     if (!($152)) {
      _abort();
      // unreachable;
     }
     $153 = ((($v$0$i$lcssa)) + 24|0);
     $154 = HEAP32[$153>>2]|0;
     $155 = ((($v$0$i$lcssa)) + 12|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ($156|0)==($v$0$i$lcssa|0);
     do {
      if ($157) {
       $167 = ((($v$0$i$lcssa)) + 20|0);
       $168 = HEAP32[$167>>2]|0;
       $169 = ($168|0)==(0|0);
       if ($169) {
        $170 = ((($v$0$i$lcssa)) + 16|0);
        $171 = HEAP32[$170>>2]|0;
        $172 = ($171|0)==(0|0);
        if ($172) {
         $R$1$i = 0;
         break;
        } else {
         $R$0$i = $171;$RP$0$i = $170;
        }
       } else {
        $R$0$i = $168;$RP$0$i = $167;
       }
       while(1) {
        $173 = ((($R$0$i)) + 20|0);
        $174 = HEAP32[$173>>2]|0;
        $175 = ($174|0)==(0|0);
        if (!($175)) {
         $R$0$i = $174;$RP$0$i = $173;
         continue;
        }
        $176 = ((($R$0$i)) + 16|0);
        $177 = HEAP32[$176>>2]|0;
        $178 = ($177|0)==(0|0);
        if ($178) {
         $R$0$i$lcssa = $R$0$i;$RP$0$i$lcssa = $RP$0$i;
         break;
        } else {
         $R$0$i = $177;$RP$0$i = $176;
        }
       }
       $179 = ($RP$0$i$lcssa>>>0)<($149>>>0);
       if ($179) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$0$i$lcssa>>2] = 0;
        $R$1$i = $R$0$i$lcssa;
        break;
       }
      } else {
       $158 = ((($v$0$i$lcssa)) + 8|0);
       $159 = HEAP32[$158>>2]|0;
       $160 = ($159>>>0)<($149>>>0);
       if ($160) {
        _abort();
        // unreachable;
       }
       $161 = ((($159)) + 12|0);
       $162 = HEAP32[$161>>2]|0;
       $163 = ($162|0)==($v$0$i$lcssa|0);
       if (!($163)) {
        _abort();
        // unreachable;
       }
       $164 = ((($156)) + 8|0);
       $165 = HEAP32[$164>>2]|0;
       $166 = ($165|0)==($v$0$i$lcssa|0);
       if ($166) {
        HEAP32[$161>>2] = $156;
        HEAP32[$164>>2] = $159;
        $R$1$i = $156;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $180 = ($154|0)==(0|0);
     do {
      if (!($180)) {
       $181 = ((($v$0$i$lcssa)) + 28|0);
       $182 = HEAP32[$181>>2]|0;
       $183 = (8592 + ($182<<2)|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($v$0$i$lcssa|0)==($184|0);
       if ($185) {
        HEAP32[$183>>2] = $R$1$i;
        $cond$i = ($R$1$i|0)==(0|0);
        if ($cond$i) {
         $186 = 1 << $182;
         $187 = $186 ^ -1;
         $188 = HEAP32[(8292)>>2]|0;
         $189 = $188 & $187;
         HEAP32[(8292)>>2] = $189;
         break;
        }
       } else {
        $190 = HEAP32[(8304)>>2]|0;
        $191 = ($154>>>0)<($190>>>0);
        if ($191) {
         _abort();
         // unreachable;
        }
        $192 = ((($154)) + 16|0);
        $193 = HEAP32[$192>>2]|0;
        $194 = ($193|0)==($v$0$i$lcssa|0);
        if ($194) {
         HEAP32[$192>>2] = $R$1$i;
        } else {
         $195 = ((($154)) + 20|0);
         HEAP32[$195>>2] = $R$1$i;
        }
        $196 = ($R$1$i|0)==(0|0);
        if ($196) {
         break;
        }
       }
       $197 = HEAP32[(8304)>>2]|0;
       $198 = ($R$1$i>>>0)<($197>>>0);
       if ($198) {
        _abort();
        // unreachable;
       }
       $199 = ((($R$1$i)) + 24|0);
       HEAP32[$199>>2] = $154;
       $200 = ((($v$0$i$lcssa)) + 16|0);
       $201 = HEAP32[$200>>2]|0;
       $202 = ($201|0)==(0|0);
       do {
        if (!($202)) {
         $203 = ($201>>>0)<($197>>>0);
         if ($203) {
          _abort();
          // unreachable;
         } else {
          $204 = ((($R$1$i)) + 16|0);
          HEAP32[$204>>2] = $201;
          $205 = ((($201)) + 24|0);
          HEAP32[$205>>2] = $R$1$i;
          break;
         }
        }
       } while(0);
       $206 = ((($v$0$i$lcssa)) + 20|0);
       $207 = HEAP32[$206>>2]|0;
       $208 = ($207|0)==(0|0);
       if (!($208)) {
        $209 = HEAP32[(8304)>>2]|0;
        $210 = ($207>>>0)<($209>>>0);
        if ($210) {
         _abort();
         // unreachable;
        } else {
         $211 = ((($R$1$i)) + 20|0);
         HEAP32[$211>>2] = $207;
         $212 = ((($207)) + 24|0);
         HEAP32[$212>>2] = $R$1$i;
         break;
        }
       }
      }
     } while(0);
     $213 = ($rsize$0$i$lcssa>>>0)<(16);
     if ($213) {
      $214 = (($rsize$0$i$lcssa) + ($4))|0;
      $215 = $214 | 3;
      $216 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$216>>2] = $215;
      $$sum4$i = (($214) + 4)|0;
      $217 = (($v$0$i$lcssa) + ($$sum4$i)|0);
      $218 = HEAP32[$217>>2]|0;
      $219 = $218 | 1;
      HEAP32[$217>>2] = $219;
     } else {
      $220 = $4 | 3;
      $221 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$221>>2] = $220;
      $222 = $rsize$0$i$lcssa | 1;
      $$sum$i35 = $4 | 4;
      $223 = (($v$0$i$lcssa) + ($$sum$i35)|0);
      HEAP32[$223>>2] = $222;
      $$sum1$i = (($rsize$0$i$lcssa) + ($4))|0;
      $224 = (($v$0$i$lcssa) + ($$sum1$i)|0);
      HEAP32[$224>>2] = $rsize$0$i$lcssa;
      $225 = HEAP32[(8296)>>2]|0;
      $226 = ($225|0)==(0);
      if (!($226)) {
       $227 = HEAP32[(8308)>>2]|0;
       $228 = $225 >>> 3;
       $229 = $228 << 1;
       $230 = (8328 + ($229<<2)|0);
       $231 = HEAP32[8288>>2]|0;
       $232 = 1 << $228;
       $233 = $231 & $232;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $231 | $232;
        HEAP32[8288>>2] = $235;
        $$pre$i = (($229) + 2)|0;
        $$pre8$i = (8328 + ($$pre$i<<2)|0);
        $$pre$phi$iZ2D = $$pre8$i;$F1$0$i = $230;
       } else {
        $$sum3$i = (($229) + 2)|0;
        $236 = (8328 + ($$sum3$i<<2)|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(8304)>>2]|0;
        $239 = ($237>>>0)<($238>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $236;$F1$0$i = $237;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $227;
       $240 = ((($F1$0$i)) + 12|0);
       HEAP32[$240>>2] = $227;
       $241 = ((($227)) + 8|0);
       HEAP32[$241>>2] = $F1$0$i;
       $242 = ((($227)) + 12|0);
       HEAP32[$242>>2] = $230;
      }
      HEAP32[(8296)>>2] = $rsize$0$i$lcssa;
      HEAP32[(8308)>>2] = $151;
     }
     $243 = ((($v$0$i$lcssa)) + 8|0);
     $mem$0 = $243;
     return ($mem$0|0);
    }
   } else {
    $nb$0 = $4;
   }
  } else {
   $244 = ($bytes>>>0)>(4294967231);
   if ($244) {
    $nb$0 = -1;
   } else {
    $245 = (($bytes) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(8292)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $nb$0 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $idx$0$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $idx$0$i = 31;
      } else {
       $253 = (($250) + 1048320)|0;
       $254 = $253 >>> 16;
       $255 = $254 & 8;
       $256 = $250 << $255;
       $257 = (($256) + 520192)|0;
       $258 = $257 >>> 16;
       $259 = $258 & 4;
       $260 = $259 | $255;
       $261 = $256 << $259;
       $262 = (($261) + 245760)|0;
       $263 = $262 >>> 16;
       $264 = $263 & 2;
       $265 = $260 | $264;
       $266 = (14 - ($265))|0;
       $267 = $261 << $264;
       $268 = $267 >>> 15;
       $269 = (($266) + ($268))|0;
       $270 = $269 << 1;
       $271 = (($269) + 7)|0;
       $272 = $246 >>> $271;
       $273 = $272 & 1;
       $274 = $273 | $270;
       $idx$0$i = $274;
      }
     }
     $275 = (8592 + ($idx$0$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L123: do {
      if ($277) {
       $rsize$2$i = $249;$t$1$i = 0;$v$2$i = 0;
       label = 86;
      } else {
       $278 = ($idx$0$i|0)==(31);
       $279 = $idx$0$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $rsize$0$i15 = $249;$rst$0$i = 0;$sizebits$0$i = $282;$t$0$i14 = $276;$v$0$i16 = 0;
       while(1) {
        $283 = ((($t$0$i14)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($rsize$0$i15>>>0);
        if ($287) {
         $288 = ($285|0)==($246|0);
         if ($288) {
          $rsize$331$i = $286;$t$230$i = $t$0$i14;$v$332$i = $t$0$i14;
          label = 90;
          break L123;
         } else {
          $rsize$1$i = $286;$v$1$i = $t$0$i14;
         }
        } else {
         $rsize$1$i = $rsize$0$i15;$v$1$i = $v$0$i16;
        }
        $289 = ((($t$0$i14)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $sizebits$0$i >>> 31;
        $292 = (((($t$0$i14)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond19$i = $294 | $295;
        $rst$1$i = $or$cond19$i ? $rst$0$i : $290;
        $296 = ($293|0)==(0|0);
        $297 = $sizebits$0$i << 1;
        if ($296) {
         $rsize$2$i = $rsize$1$i;$t$1$i = $rst$1$i;$v$2$i = $v$1$i;
         label = 86;
         break;
        } else {
         $rsize$0$i15 = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $297;$t$0$i14 = $293;$v$0$i16 = $v$1$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $298 = ($t$1$i|0)==(0|0);
      $299 = ($v$2$i|0)==(0|0);
      $or$cond$i = $298 & $299;
      if ($or$cond$i) {
       $300 = 2 << $idx$0$i;
       $301 = (0 - ($300))|0;
       $302 = $300 | $301;
       $303 = $247 & $302;
       $304 = ($303|0)==(0);
       if ($304) {
        $nb$0 = $246;
        break;
       }
       $305 = (0 - ($303))|0;
       $306 = $303 & $305;
       $307 = (($306) + -1)|0;
       $308 = $307 >>> 12;
       $309 = $308 & 16;
       $310 = $307 >>> $309;
       $311 = $310 >>> 5;
       $312 = $311 & 8;
       $313 = $312 | $309;
       $314 = $310 >>> $312;
       $315 = $314 >>> 2;
       $316 = $315 & 4;
       $317 = $313 | $316;
       $318 = $314 >>> $316;
       $319 = $318 >>> 1;
       $320 = $319 & 2;
       $321 = $317 | $320;
       $322 = $318 >>> $320;
       $323 = $322 >>> 1;
       $324 = $323 & 1;
       $325 = $321 | $324;
       $326 = $322 >>> $324;
       $327 = (($325) + ($326))|0;
       $328 = (8592 + ($327<<2)|0);
       $329 = HEAP32[$328>>2]|0;
       $t$2$ph$i = $329;$v$3$ph$i = 0;
      } else {
       $t$2$ph$i = $t$1$i;$v$3$ph$i = $v$2$i;
      }
      $330 = ($t$2$ph$i|0)==(0|0);
      if ($330) {
       $rsize$3$lcssa$i = $rsize$2$i;$v$3$lcssa$i = $v$3$ph$i;
      } else {
       $rsize$331$i = $rsize$2$i;$t$230$i = $t$2$ph$i;$v$332$i = $v$3$ph$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $331 = ((($t$230$i)) + 4|0);
       $332 = HEAP32[$331>>2]|0;
       $333 = $332 & -8;
       $334 = (($333) - ($246))|0;
       $335 = ($334>>>0)<($rsize$331$i>>>0);
       $$rsize$3$i = $335 ? $334 : $rsize$331$i;
       $t$2$v$3$i = $335 ? $t$230$i : $v$332$i;
       $336 = ((($t$230$i)) + 16|0);
       $337 = HEAP32[$336>>2]|0;
       $338 = ($337|0)==(0|0);
       if (!($338)) {
        $rsize$331$i = $$rsize$3$i;$t$230$i = $337;$v$332$i = $t$2$v$3$i;
        label = 90;
        continue;
       }
       $339 = ((($t$230$i)) + 20|0);
       $340 = HEAP32[$339>>2]|0;
       $341 = ($340|0)==(0|0);
       if ($341) {
        $rsize$3$lcssa$i = $$rsize$3$i;$v$3$lcssa$i = $t$2$v$3$i;
        break;
       } else {
        $rsize$331$i = $$rsize$3$i;$t$230$i = $340;$v$332$i = $t$2$v$3$i;
        label = 90;
       }
      }
     }
     $342 = ($v$3$lcssa$i|0)==(0|0);
     if ($342) {
      $nb$0 = $246;
     } else {
      $343 = HEAP32[(8296)>>2]|0;
      $344 = (($343) - ($246))|0;
      $345 = ($rsize$3$lcssa$i>>>0)<($344>>>0);
      if ($345) {
       $346 = HEAP32[(8304)>>2]|0;
       $347 = ($v$3$lcssa$i>>>0)<($346>>>0);
       if ($347) {
        _abort();
        // unreachable;
       }
       $348 = (($v$3$lcssa$i) + ($246)|0);
       $349 = ($v$3$lcssa$i>>>0)<($348>>>0);
       if (!($349)) {
        _abort();
        // unreachable;
       }
       $350 = ((($v$3$lcssa$i)) + 24|0);
       $351 = HEAP32[$350>>2]|0;
       $352 = ((($v$3$lcssa$i)) + 12|0);
       $353 = HEAP32[$352>>2]|0;
       $354 = ($353|0)==($v$3$lcssa$i|0);
       do {
        if ($354) {
         $364 = ((($v$3$lcssa$i)) + 20|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==(0|0);
         if ($366) {
          $367 = ((($v$3$lcssa$i)) + 16|0);
          $368 = HEAP32[$367>>2]|0;
          $369 = ($368|0)==(0|0);
          if ($369) {
           $R$1$i20 = 0;
           break;
          } else {
           $R$0$i18 = $368;$RP$0$i17 = $367;
          }
         } else {
          $R$0$i18 = $365;$RP$0$i17 = $364;
         }
         while(1) {
          $370 = ((($R$0$i18)) + 20|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if (!($372)) {
           $R$0$i18 = $371;$RP$0$i17 = $370;
           continue;
          }
          $373 = ((($R$0$i18)) + 16|0);
          $374 = HEAP32[$373>>2]|0;
          $375 = ($374|0)==(0|0);
          if ($375) {
           $R$0$i18$lcssa = $R$0$i18;$RP$0$i17$lcssa = $RP$0$i17;
           break;
          } else {
           $R$0$i18 = $374;$RP$0$i17 = $373;
          }
         }
         $376 = ($RP$0$i17$lcssa>>>0)<($346>>>0);
         if ($376) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$0$i17$lcssa>>2] = 0;
          $R$1$i20 = $R$0$i18$lcssa;
          break;
         }
        } else {
         $355 = ((($v$3$lcssa$i)) + 8|0);
         $356 = HEAP32[$355>>2]|0;
         $357 = ($356>>>0)<($346>>>0);
         if ($357) {
          _abort();
          // unreachable;
         }
         $358 = ((($356)) + 12|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==($v$3$lcssa$i|0);
         if (!($360)) {
          _abort();
          // unreachable;
         }
         $361 = ((($353)) + 8|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($v$3$lcssa$i|0);
         if ($363) {
          HEAP32[$358>>2] = $353;
          HEAP32[$361>>2] = $356;
          $R$1$i20 = $353;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $377 = ($351|0)==(0|0);
       do {
        if (!($377)) {
         $378 = ((($v$3$lcssa$i)) + 28|0);
         $379 = HEAP32[$378>>2]|0;
         $380 = (8592 + ($379<<2)|0);
         $381 = HEAP32[$380>>2]|0;
         $382 = ($v$3$lcssa$i|0)==($381|0);
         if ($382) {
          HEAP32[$380>>2] = $R$1$i20;
          $cond$i21 = ($R$1$i20|0)==(0|0);
          if ($cond$i21) {
           $383 = 1 << $379;
           $384 = $383 ^ -1;
           $385 = HEAP32[(8292)>>2]|0;
           $386 = $385 & $384;
           HEAP32[(8292)>>2] = $386;
           break;
          }
         } else {
          $387 = HEAP32[(8304)>>2]|0;
          $388 = ($351>>>0)<($387>>>0);
          if ($388) {
           _abort();
           // unreachable;
          }
          $389 = ((($351)) + 16|0);
          $390 = HEAP32[$389>>2]|0;
          $391 = ($390|0)==($v$3$lcssa$i|0);
          if ($391) {
           HEAP32[$389>>2] = $R$1$i20;
          } else {
           $392 = ((($351)) + 20|0);
           HEAP32[$392>>2] = $R$1$i20;
          }
          $393 = ($R$1$i20|0)==(0|0);
          if ($393) {
           break;
          }
         }
         $394 = HEAP32[(8304)>>2]|0;
         $395 = ($R$1$i20>>>0)<($394>>>0);
         if ($395) {
          _abort();
          // unreachable;
         }
         $396 = ((($R$1$i20)) + 24|0);
         HEAP32[$396>>2] = $351;
         $397 = ((($v$3$lcssa$i)) + 16|0);
         $398 = HEAP32[$397>>2]|0;
         $399 = ($398|0)==(0|0);
         do {
          if (!($399)) {
           $400 = ($398>>>0)<($394>>>0);
           if ($400) {
            _abort();
            // unreachable;
           } else {
            $401 = ((($R$1$i20)) + 16|0);
            HEAP32[$401>>2] = $398;
            $402 = ((($398)) + 24|0);
            HEAP32[$402>>2] = $R$1$i20;
            break;
           }
          }
         } while(0);
         $403 = ((($v$3$lcssa$i)) + 20|0);
         $404 = HEAP32[$403>>2]|0;
         $405 = ($404|0)==(0|0);
         if (!($405)) {
          $406 = HEAP32[(8304)>>2]|0;
          $407 = ($404>>>0)<($406>>>0);
          if ($407) {
           _abort();
           // unreachable;
          } else {
           $408 = ((($R$1$i20)) + 20|0);
           HEAP32[$408>>2] = $404;
           $409 = ((($404)) + 24|0);
           HEAP32[$409>>2] = $R$1$i20;
           break;
          }
         }
        }
       } while(0);
       $410 = ($rsize$3$lcssa$i>>>0)<(16);
       L199: do {
        if ($410) {
         $411 = (($rsize$3$lcssa$i) + ($246))|0;
         $412 = $411 | 3;
         $413 = ((($v$3$lcssa$i)) + 4|0);
         HEAP32[$413>>2] = $412;
         $$sum18$i = (($411) + 4)|0;
         $414 = (($v$3$lcssa$i) + ($$sum18$i)|0);
         $415 = HEAP32[$414>>2]|0;
         $416 = $415 | 1;
         HEAP32[$414>>2] = $416;
        } else {
         $417 = $246 | 3;
         $418 = ((($v$3$lcssa$i)) + 4|0);
         HEAP32[$418>>2] = $417;
         $419 = $rsize$3$lcssa$i | 1;
         $$sum$i2334 = $246 | 4;
         $420 = (($v$3$lcssa$i) + ($$sum$i2334)|0);
         HEAP32[$420>>2] = $419;
         $$sum1$i24 = (($rsize$3$lcssa$i) + ($246))|0;
         $421 = (($v$3$lcssa$i) + ($$sum1$i24)|0);
         HEAP32[$421>>2] = $rsize$3$lcssa$i;
         $422 = $rsize$3$lcssa$i >>> 3;
         $423 = ($rsize$3$lcssa$i>>>0)<(256);
         if ($423) {
          $424 = $422 << 1;
          $425 = (8328 + ($424<<2)|0);
          $426 = HEAP32[8288>>2]|0;
          $427 = 1 << $422;
          $428 = $426 & $427;
          $429 = ($428|0)==(0);
          if ($429) {
           $430 = $426 | $427;
           HEAP32[8288>>2] = $430;
           $$pre$i25 = (($424) + 2)|0;
           $$pre43$i = (8328 + ($$pre$i25<<2)|0);
           $$pre$phi$i26Z2D = $$pre43$i;$F5$0$i = $425;
          } else {
           $$sum17$i = (($424) + 2)|0;
           $431 = (8328 + ($$sum17$i<<2)|0);
           $432 = HEAP32[$431>>2]|0;
           $433 = HEAP32[(8304)>>2]|0;
           $434 = ($432>>>0)<($433>>>0);
           if ($434) {
            _abort();
            // unreachable;
           } else {
            $$pre$phi$i26Z2D = $431;$F5$0$i = $432;
           }
          }
          HEAP32[$$pre$phi$i26Z2D>>2] = $348;
          $435 = ((($F5$0$i)) + 12|0);
          HEAP32[$435>>2] = $348;
          $$sum15$i = (($246) + 8)|0;
          $436 = (($v$3$lcssa$i) + ($$sum15$i)|0);
          HEAP32[$436>>2] = $F5$0$i;
          $$sum16$i = (($246) + 12)|0;
          $437 = (($v$3$lcssa$i) + ($$sum16$i)|0);
          HEAP32[$437>>2] = $425;
          break;
         }
         $438 = $rsize$3$lcssa$i >>> 8;
         $439 = ($438|0)==(0);
         if ($439) {
          $I7$0$i = 0;
         } else {
          $440 = ($rsize$3$lcssa$i>>>0)>(16777215);
          if ($440) {
           $I7$0$i = 31;
          } else {
           $441 = (($438) + 1048320)|0;
           $442 = $441 >>> 16;
           $443 = $442 & 8;
           $444 = $438 << $443;
           $445 = (($444) + 520192)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 4;
           $448 = $447 | $443;
           $449 = $444 << $447;
           $450 = (($449) + 245760)|0;
           $451 = $450 >>> 16;
           $452 = $451 & 2;
           $453 = $448 | $452;
           $454 = (14 - ($453))|0;
           $455 = $449 << $452;
           $456 = $455 >>> 15;
           $457 = (($454) + ($456))|0;
           $458 = $457 << 1;
           $459 = (($457) + 7)|0;
           $460 = $rsize$3$lcssa$i >>> $459;
           $461 = $460 & 1;
           $462 = $461 | $458;
           $I7$0$i = $462;
          }
         }
         $463 = (8592 + ($I7$0$i<<2)|0);
         $$sum2$i = (($246) + 28)|0;
         $464 = (($v$3$lcssa$i) + ($$sum2$i)|0);
         HEAP32[$464>>2] = $I7$0$i;
         $$sum3$i27 = (($246) + 16)|0;
         $465 = (($v$3$lcssa$i) + ($$sum3$i27)|0);
         $$sum4$i28 = (($246) + 20)|0;
         $466 = (($v$3$lcssa$i) + ($$sum4$i28)|0);
         HEAP32[$466>>2] = 0;
         HEAP32[$465>>2] = 0;
         $467 = HEAP32[(8292)>>2]|0;
         $468 = 1 << $I7$0$i;
         $469 = $467 & $468;
         $470 = ($469|0)==(0);
         if ($470) {
          $471 = $467 | $468;
          HEAP32[(8292)>>2] = $471;
          HEAP32[$463>>2] = $348;
          $$sum5$i = (($246) + 24)|0;
          $472 = (($v$3$lcssa$i) + ($$sum5$i)|0);
          HEAP32[$472>>2] = $463;
          $$sum6$i = (($246) + 12)|0;
          $473 = (($v$3$lcssa$i) + ($$sum6$i)|0);
          HEAP32[$473>>2] = $348;
          $$sum7$i = (($246) + 8)|0;
          $474 = (($v$3$lcssa$i) + ($$sum7$i)|0);
          HEAP32[$474>>2] = $348;
          break;
         }
         $475 = HEAP32[$463>>2]|0;
         $476 = ((($475)) + 4|0);
         $477 = HEAP32[$476>>2]|0;
         $478 = $477 & -8;
         $479 = ($478|0)==($rsize$3$lcssa$i|0);
         L217: do {
          if ($479) {
           $T$0$lcssa$i = $475;
          } else {
           $480 = ($I7$0$i|0)==(31);
           $481 = $I7$0$i >>> 1;
           $482 = (25 - ($481))|0;
           $483 = $480 ? 0 : $482;
           $484 = $rsize$3$lcssa$i << $483;
           $K12$029$i = $484;$T$028$i = $475;
           while(1) {
            $491 = $K12$029$i >>> 31;
            $492 = (((($T$028$i)) + 16|0) + ($491<<2)|0);
            $487 = HEAP32[$492>>2]|0;
            $493 = ($487|0)==(0|0);
            if ($493) {
             $$lcssa232 = $492;$T$028$i$lcssa = $T$028$i;
             break;
            }
            $485 = $K12$029$i << 1;
            $486 = ((($487)) + 4|0);
            $488 = HEAP32[$486>>2]|0;
            $489 = $488 & -8;
            $490 = ($489|0)==($rsize$3$lcssa$i|0);
            if ($490) {
             $T$0$lcssa$i = $487;
             break L217;
            } else {
             $K12$029$i = $485;$T$028$i = $487;
            }
           }
           $494 = HEAP32[(8304)>>2]|0;
           $495 = ($$lcssa232>>>0)<($494>>>0);
           if ($495) {
            _abort();
            // unreachable;
           } else {
            HEAP32[$$lcssa232>>2] = $348;
            $$sum11$i = (($246) + 24)|0;
            $496 = (($v$3$lcssa$i) + ($$sum11$i)|0);
            HEAP32[$496>>2] = $T$028$i$lcssa;
            $$sum12$i = (($246) + 12)|0;
            $497 = (($v$3$lcssa$i) + ($$sum12$i)|0);
            HEAP32[$497>>2] = $348;
            $$sum13$i = (($246) + 8)|0;
            $498 = (($v$3$lcssa$i) + ($$sum13$i)|0);
            HEAP32[$498>>2] = $348;
            break L199;
           }
          }
         } while(0);
         $499 = ((($T$0$lcssa$i)) + 8|0);
         $500 = HEAP32[$499>>2]|0;
         $501 = HEAP32[(8304)>>2]|0;
         $502 = ($500>>>0)>=($501>>>0);
         $not$$i = ($T$0$lcssa$i>>>0)>=($501>>>0);
         $503 = $502 & $not$$i;
         if ($503) {
          $504 = ((($500)) + 12|0);
          HEAP32[$504>>2] = $348;
          HEAP32[$499>>2] = $348;
          $$sum8$i = (($246) + 8)|0;
          $505 = (($v$3$lcssa$i) + ($$sum8$i)|0);
          HEAP32[$505>>2] = $500;
          $$sum9$i = (($246) + 12)|0;
          $506 = (($v$3$lcssa$i) + ($$sum9$i)|0);
          HEAP32[$506>>2] = $T$0$lcssa$i;
          $$sum10$i = (($246) + 24)|0;
          $507 = (($v$3$lcssa$i) + ($$sum10$i)|0);
          HEAP32[$507>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $508 = ((($v$3$lcssa$i)) + 8|0);
       $mem$0 = $508;
       return ($mem$0|0);
      } else {
       $nb$0 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $509 = HEAP32[(8296)>>2]|0;
 $510 = ($509>>>0)<($nb$0>>>0);
 if (!($510)) {
  $511 = (($509) - ($nb$0))|0;
  $512 = HEAP32[(8308)>>2]|0;
  $513 = ($511>>>0)>(15);
  if ($513) {
   $514 = (($512) + ($nb$0)|0);
   HEAP32[(8308)>>2] = $514;
   HEAP32[(8296)>>2] = $511;
   $515 = $511 | 1;
   $$sum2 = (($nb$0) + 4)|0;
   $516 = (($512) + ($$sum2)|0);
   HEAP32[$516>>2] = $515;
   $517 = (($512) + ($509)|0);
   HEAP32[$517>>2] = $511;
   $518 = $nb$0 | 3;
   $519 = ((($512)) + 4|0);
   HEAP32[$519>>2] = $518;
  } else {
   HEAP32[(8296)>>2] = 0;
   HEAP32[(8308)>>2] = 0;
   $520 = $509 | 3;
   $521 = ((($512)) + 4|0);
   HEAP32[$521>>2] = $520;
   $$sum1 = (($509) + 4)|0;
   $522 = (($512) + ($$sum1)|0);
   $523 = HEAP32[$522>>2]|0;
   $524 = $523 | 1;
   HEAP32[$522>>2] = $524;
  }
  $525 = ((($512)) + 8|0);
  $mem$0 = $525;
  return ($mem$0|0);
 }
 $526 = HEAP32[(8300)>>2]|0;
 $527 = ($526>>>0)>($nb$0>>>0);
 if ($527) {
  $528 = (($526) - ($nb$0))|0;
  HEAP32[(8300)>>2] = $528;
  $529 = HEAP32[(8312)>>2]|0;
  $530 = (($529) + ($nb$0)|0);
  HEAP32[(8312)>>2] = $530;
  $531 = $528 | 1;
  $$sum = (($nb$0) + 4)|0;
  $532 = (($529) + ($$sum)|0);
  HEAP32[$532>>2] = $531;
  $533 = $nb$0 | 3;
  $534 = ((($529)) + 4|0);
  HEAP32[$534>>2] = $533;
  $535 = ((($529)) + 8|0);
  $mem$0 = $535;
  return ($mem$0|0);
 }
 $536 = HEAP32[8760>>2]|0;
 $537 = ($536|0)==(0);
 do {
  if ($537) {
   $538 = (_sysconf(30)|0);
   $539 = (($538) + -1)|0;
   $540 = $539 & $538;
   $541 = ($540|0)==(0);
   if ($541) {
    HEAP32[(8768)>>2] = $538;
    HEAP32[(8764)>>2] = $538;
    HEAP32[(8772)>>2] = -1;
    HEAP32[(8776)>>2] = -1;
    HEAP32[(8780)>>2] = 0;
    HEAP32[(8732)>>2] = 0;
    $542 = (_time((0|0))|0);
    $543 = $542 & -16;
    $544 = $543 ^ 1431655768;
    HEAP32[8760>>2] = $544;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $545 = (($nb$0) + 48)|0;
 $546 = HEAP32[(8768)>>2]|0;
 $547 = (($nb$0) + 47)|0;
 $548 = (($546) + ($547))|0;
 $549 = (0 - ($546))|0;
 $550 = $548 & $549;
 $551 = ($550>>>0)>($nb$0>>>0);
 if (!($551)) {
  $mem$0 = 0;
  return ($mem$0|0);
 }
 $552 = HEAP32[(8728)>>2]|0;
 $553 = ($552|0)==(0);
 if (!($553)) {
  $554 = HEAP32[(8720)>>2]|0;
  $555 = (($554) + ($550))|0;
  $556 = ($555>>>0)<=($554>>>0);
  $557 = ($555>>>0)>($552>>>0);
  $or$cond1$i = $556 | $557;
  if ($or$cond1$i) {
   $mem$0 = 0;
   return ($mem$0|0);
  }
 }
 $558 = HEAP32[(8732)>>2]|0;
 $559 = $558 & 4;
 $560 = ($559|0)==(0);
 L258: do {
  if ($560) {
   $561 = HEAP32[(8312)>>2]|0;
   $562 = ($561|0)==(0|0);
   L260: do {
    if ($562) {
     label = 174;
    } else {
     $sp$0$i$i = (8736);
     while(1) {
      $563 = HEAP32[$sp$0$i$i>>2]|0;
      $564 = ($563>>>0)>($561>>>0);
      if (!($564)) {
       $565 = ((($sp$0$i$i)) + 4|0);
       $566 = HEAP32[$565>>2]|0;
       $567 = (($563) + ($566)|0);
       $568 = ($567>>>0)>($561>>>0);
       if ($568) {
        $$lcssa228 = $sp$0$i$i;$$lcssa230 = $565;
        break;
       }
      }
      $569 = ((($sp$0$i$i)) + 8|0);
      $570 = HEAP32[$569>>2]|0;
      $571 = ($570|0)==(0|0);
      if ($571) {
       label = 174;
       break L260;
      } else {
       $sp$0$i$i = $570;
      }
     }
     $594 = HEAP32[(8300)>>2]|0;
     $595 = (($548) - ($594))|0;
     $596 = $595 & $549;
     $597 = ($596>>>0)<(2147483647);
     if ($597) {
      $598 = (_sbrk(($596|0))|0);
      $599 = HEAP32[$$lcssa228>>2]|0;
      $600 = HEAP32[$$lcssa230>>2]|0;
      $601 = (($599) + ($600)|0);
      $602 = ($598|0)==($601|0);
      $$3$i = $602 ? $596 : 0;
      if ($602) {
       $603 = ($598|0)==((-1)|0);
       if ($603) {
        $tsize$0323944$i = $$3$i;
       } else {
        $tbase$255$i = $598;$tsize$254$i = $$3$i;
        label = 194;
        break L258;
       }
      } else {
       $br$0$ph$i = $598;$ssize$1$ph$i = $596;$tsize$0$ph$i = $$3$i;
       label = 184;
      }
     } else {
      $tsize$0323944$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 174) {
     $572 = (_sbrk(0)|0);
     $573 = ($572|0)==((-1)|0);
     if ($573) {
      $tsize$0323944$i = 0;
     } else {
      $574 = $572;
      $575 = HEAP32[(8764)>>2]|0;
      $576 = (($575) + -1)|0;
      $577 = $576 & $574;
      $578 = ($577|0)==(0);
      if ($578) {
       $ssize$0$i = $550;
      } else {
       $579 = (($576) + ($574))|0;
       $580 = (0 - ($575))|0;
       $581 = $579 & $580;
       $582 = (($550) - ($574))|0;
       $583 = (($582) + ($581))|0;
       $ssize$0$i = $583;
      }
      $584 = HEAP32[(8720)>>2]|0;
      $585 = (($584) + ($ssize$0$i))|0;
      $586 = ($ssize$0$i>>>0)>($nb$0>>>0);
      $587 = ($ssize$0$i>>>0)<(2147483647);
      $or$cond$i30 = $586 & $587;
      if ($or$cond$i30) {
       $588 = HEAP32[(8728)>>2]|0;
       $589 = ($588|0)==(0);
       if (!($589)) {
        $590 = ($585>>>0)<=($584>>>0);
        $591 = ($585>>>0)>($588>>>0);
        $or$cond2$i = $590 | $591;
        if ($or$cond2$i) {
         $tsize$0323944$i = 0;
         break;
        }
       }
       $592 = (_sbrk(($ssize$0$i|0))|0);
       $593 = ($592|0)==($572|0);
       $ssize$0$$i = $593 ? $ssize$0$i : 0;
       if ($593) {
        $tbase$255$i = $572;$tsize$254$i = $ssize$0$$i;
        label = 194;
        break L258;
       } else {
        $br$0$ph$i = $592;$ssize$1$ph$i = $ssize$0$i;$tsize$0$ph$i = $ssize$0$$i;
        label = 184;
       }
      } else {
       $tsize$0323944$i = 0;
      }
     }
    }
   } while(0);
   L280: do {
    if ((label|0) == 184) {
     $604 = (0 - ($ssize$1$ph$i))|0;
     $605 = ($br$0$ph$i|0)!=((-1)|0);
     $606 = ($ssize$1$ph$i>>>0)<(2147483647);
     $or$cond5$i = $606 & $605;
     $607 = ($545>>>0)>($ssize$1$ph$i>>>0);
     $or$cond6$i = $607 & $or$cond5$i;
     do {
      if ($or$cond6$i) {
       $608 = HEAP32[(8768)>>2]|0;
       $609 = (($547) - ($ssize$1$ph$i))|0;
       $610 = (($609) + ($608))|0;
       $611 = (0 - ($608))|0;
       $612 = $610 & $611;
       $613 = ($612>>>0)<(2147483647);
       if ($613) {
        $614 = (_sbrk(($612|0))|0);
        $615 = ($614|0)==((-1)|0);
        if ($615) {
         (_sbrk(($604|0))|0);
         $tsize$0323944$i = $tsize$0$ph$i;
         break L280;
        } else {
         $616 = (($612) + ($ssize$1$ph$i))|0;
         $ssize$2$i = $616;
         break;
        }
       } else {
        $ssize$2$i = $ssize$1$ph$i;
       }
      } else {
       $ssize$2$i = $ssize$1$ph$i;
      }
     } while(0);
     $617 = ($br$0$ph$i|0)==((-1)|0);
     if ($617) {
      $tsize$0323944$i = $tsize$0$ph$i;
     } else {
      $tbase$255$i = $br$0$ph$i;$tsize$254$i = $ssize$2$i;
      label = 194;
      break L258;
     }
    }
   } while(0);
   $618 = HEAP32[(8732)>>2]|0;
   $619 = $618 | 4;
   HEAP32[(8732)>>2] = $619;
   $tsize$1$i = $tsize$0323944$i;
   label = 191;
  } else {
   $tsize$1$i = 0;
   label = 191;
  }
 } while(0);
 if ((label|0) == 191) {
  $620 = ($550>>>0)<(2147483647);
  if ($620) {
   $621 = (_sbrk(($550|0))|0);
   $622 = (_sbrk(0)|0);
   $623 = ($621|0)!=((-1)|0);
   $624 = ($622|0)!=((-1)|0);
   $or$cond3$i = $623 & $624;
   $625 = ($621>>>0)<($622>>>0);
   $or$cond8$i = $625 & $or$cond3$i;
   if ($or$cond8$i) {
    $626 = $622;
    $627 = $621;
    $628 = (($626) - ($627))|0;
    $629 = (($nb$0) + 40)|0;
    $630 = ($628>>>0)>($629>>>0);
    $$tsize$1$i = $630 ? $628 : $tsize$1$i;
    if ($630) {
     $tbase$255$i = $621;$tsize$254$i = $$tsize$1$i;
     label = 194;
    }
   }
  }
 }
 if ((label|0) == 194) {
  $631 = HEAP32[(8720)>>2]|0;
  $632 = (($631) + ($tsize$254$i))|0;
  HEAP32[(8720)>>2] = $632;
  $633 = HEAP32[(8724)>>2]|0;
  $634 = ($632>>>0)>($633>>>0);
  if ($634) {
   HEAP32[(8724)>>2] = $632;
  }
  $635 = HEAP32[(8312)>>2]|0;
  $636 = ($635|0)==(0|0);
  L299: do {
   if ($636) {
    $637 = HEAP32[(8304)>>2]|0;
    $638 = ($637|0)==(0|0);
    $639 = ($tbase$255$i>>>0)<($637>>>0);
    $or$cond9$i = $638 | $639;
    if ($or$cond9$i) {
     HEAP32[(8304)>>2] = $tbase$255$i;
    }
    HEAP32[(8736)>>2] = $tbase$255$i;
    HEAP32[(8740)>>2] = $tsize$254$i;
    HEAP32[(8748)>>2] = 0;
    $640 = HEAP32[8760>>2]|0;
    HEAP32[(8324)>>2] = $640;
    HEAP32[(8320)>>2] = -1;
    $i$02$i$i = 0;
    while(1) {
     $641 = $i$02$i$i << 1;
     $642 = (8328 + ($641<<2)|0);
     $$sum$i$i = (($641) + 3)|0;
     $643 = (8328 + ($$sum$i$i<<2)|0);
     HEAP32[$643>>2] = $642;
     $$sum1$i$i = (($641) + 2)|0;
     $644 = (8328 + ($$sum1$i$i<<2)|0);
     HEAP32[$644>>2] = $642;
     $645 = (($i$02$i$i) + 1)|0;
     $exitcond$i$i = ($645|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$02$i$i = $645;
     }
    }
    $646 = (($tsize$254$i) + -40)|0;
    $647 = ((($tbase$255$i)) + 8|0);
    $648 = $647;
    $649 = $648 & 7;
    $650 = ($649|0)==(0);
    $651 = (0 - ($648))|0;
    $652 = $651 & 7;
    $653 = $650 ? 0 : $652;
    $654 = (($tbase$255$i) + ($653)|0);
    $655 = (($646) - ($653))|0;
    HEAP32[(8312)>>2] = $654;
    HEAP32[(8300)>>2] = $655;
    $656 = $655 | 1;
    $$sum$i13$i = (($653) + 4)|0;
    $657 = (($tbase$255$i) + ($$sum$i13$i)|0);
    HEAP32[$657>>2] = $656;
    $$sum2$i$i = (($tsize$254$i) + -36)|0;
    $658 = (($tbase$255$i) + ($$sum2$i$i)|0);
    HEAP32[$658>>2] = 40;
    $659 = HEAP32[(8776)>>2]|0;
    HEAP32[(8316)>>2] = $659;
   } else {
    $sp$084$i = (8736);
    while(1) {
     $660 = HEAP32[$sp$084$i>>2]|0;
     $661 = ((($sp$084$i)) + 4|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = (($660) + ($662)|0);
     $664 = ($tbase$255$i|0)==($663|0);
     if ($664) {
      $$lcssa222 = $660;$$lcssa224 = $661;$$lcssa226 = $662;$sp$084$i$lcssa = $sp$084$i;
      label = 204;
      break;
     }
     $665 = ((($sp$084$i)) + 8|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = ($666|0)==(0|0);
     if ($667) {
      break;
     } else {
      $sp$084$i = $666;
     }
    }
    if ((label|0) == 204) {
     $668 = ((($sp$084$i$lcssa)) + 12|0);
     $669 = HEAP32[$668>>2]|0;
     $670 = $669 & 8;
     $671 = ($670|0)==(0);
     if ($671) {
      $672 = ($635>>>0)>=($$lcssa222>>>0);
      $673 = ($635>>>0)<($tbase$255$i>>>0);
      $or$cond57$i = $673 & $672;
      if ($or$cond57$i) {
       $674 = (($$lcssa226) + ($tsize$254$i))|0;
       HEAP32[$$lcssa224>>2] = $674;
       $675 = HEAP32[(8300)>>2]|0;
       $676 = (($675) + ($tsize$254$i))|0;
       $677 = ((($635)) + 8|0);
       $678 = $677;
       $679 = $678 & 7;
       $680 = ($679|0)==(0);
       $681 = (0 - ($678))|0;
       $682 = $681 & 7;
       $683 = $680 ? 0 : $682;
       $684 = (($635) + ($683)|0);
       $685 = (($676) - ($683))|0;
       HEAP32[(8312)>>2] = $684;
       HEAP32[(8300)>>2] = $685;
       $686 = $685 | 1;
       $$sum$i17$i = (($683) + 4)|0;
       $687 = (($635) + ($$sum$i17$i)|0);
       HEAP32[$687>>2] = $686;
       $$sum2$i18$i = (($676) + 4)|0;
       $688 = (($635) + ($$sum2$i18$i)|0);
       HEAP32[$688>>2] = 40;
       $689 = HEAP32[(8776)>>2]|0;
       HEAP32[(8316)>>2] = $689;
       break;
      }
     }
    }
    $690 = HEAP32[(8304)>>2]|0;
    $691 = ($tbase$255$i>>>0)<($690>>>0);
    if ($691) {
     HEAP32[(8304)>>2] = $tbase$255$i;
     $755 = $tbase$255$i;
    } else {
     $755 = $690;
    }
    $692 = (($tbase$255$i) + ($tsize$254$i)|0);
    $sp$183$i = (8736);
    while(1) {
     $693 = HEAP32[$sp$183$i>>2]|0;
     $694 = ($693|0)==($692|0);
     if ($694) {
      $$lcssa219 = $sp$183$i;$sp$183$i$lcssa = $sp$183$i;
      label = 212;
      break;
     }
     $695 = ((($sp$183$i)) + 8|0);
     $696 = HEAP32[$695>>2]|0;
     $697 = ($696|0)==(0|0);
     if ($697) {
      $sp$0$i$i$i = (8736);
      break;
     } else {
      $sp$183$i = $696;
     }
    }
    if ((label|0) == 212) {
     $698 = ((($sp$183$i$lcssa)) + 12|0);
     $699 = HEAP32[$698>>2]|0;
     $700 = $699 & 8;
     $701 = ($700|0)==(0);
     if ($701) {
      HEAP32[$$lcssa219>>2] = $tbase$255$i;
      $702 = ((($sp$183$i$lcssa)) + 4|0);
      $703 = HEAP32[$702>>2]|0;
      $704 = (($703) + ($tsize$254$i))|0;
      HEAP32[$702>>2] = $704;
      $705 = ((($tbase$255$i)) + 8|0);
      $706 = $705;
      $707 = $706 & 7;
      $708 = ($707|0)==(0);
      $709 = (0 - ($706))|0;
      $710 = $709 & 7;
      $711 = $708 ? 0 : $710;
      $712 = (($tbase$255$i) + ($711)|0);
      $$sum112$i = (($tsize$254$i) + 8)|0;
      $713 = (($tbase$255$i) + ($$sum112$i)|0);
      $714 = $713;
      $715 = $714 & 7;
      $716 = ($715|0)==(0);
      $717 = (0 - ($714))|0;
      $718 = $717 & 7;
      $719 = $716 ? 0 : $718;
      $$sum113$i = (($719) + ($tsize$254$i))|0;
      $720 = (($tbase$255$i) + ($$sum113$i)|0);
      $721 = $720;
      $722 = $712;
      $723 = (($721) - ($722))|0;
      $$sum$i19$i = (($711) + ($nb$0))|0;
      $724 = (($tbase$255$i) + ($$sum$i19$i)|0);
      $725 = (($723) - ($nb$0))|0;
      $726 = $nb$0 | 3;
      $$sum1$i20$i = (($711) + 4)|0;
      $727 = (($tbase$255$i) + ($$sum1$i20$i)|0);
      HEAP32[$727>>2] = $726;
      $728 = ($720|0)==($635|0);
      L324: do {
       if ($728) {
        $729 = HEAP32[(8300)>>2]|0;
        $730 = (($729) + ($725))|0;
        HEAP32[(8300)>>2] = $730;
        HEAP32[(8312)>>2] = $724;
        $731 = $730 | 1;
        $$sum42$i$i = (($$sum$i19$i) + 4)|0;
        $732 = (($tbase$255$i) + ($$sum42$i$i)|0);
        HEAP32[$732>>2] = $731;
       } else {
        $733 = HEAP32[(8308)>>2]|0;
        $734 = ($720|0)==($733|0);
        if ($734) {
         $735 = HEAP32[(8296)>>2]|0;
         $736 = (($735) + ($725))|0;
         HEAP32[(8296)>>2] = $736;
         HEAP32[(8308)>>2] = $724;
         $737 = $736 | 1;
         $$sum40$i$i = (($$sum$i19$i) + 4)|0;
         $738 = (($tbase$255$i) + ($$sum40$i$i)|0);
         HEAP32[$738>>2] = $737;
         $$sum41$i$i = (($736) + ($$sum$i19$i))|0;
         $739 = (($tbase$255$i) + ($$sum41$i$i)|0);
         HEAP32[$739>>2] = $736;
         break;
        }
        $$sum2$i21$i = (($tsize$254$i) + 4)|0;
        $$sum114$i = (($$sum2$i21$i) + ($719))|0;
        $740 = (($tbase$255$i) + ($$sum114$i)|0);
        $741 = HEAP32[$740>>2]|0;
        $742 = $741 & 3;
        $743 = ($742|0)==(1);
        if ($743) {
         $744 = $741 & -8;
         $745 = $741 >>> 3;
         $746 = ($741>>>0)<(256);
         L332: do {
          if ($746) {
           $$sum3738$i$i = $719 | 8;
           $$sum124$i = (($$sum3738$i$i) + ($tsize$254$i))|0;
           $747 = (($tbase$255$i) + ($$sum124$i)|0);
           $748 = HEAP32[$747>>2]|0;
           $$sum39$i$i = (($tsize$254$i) + 12)|0;
           $$sum125$i = (($$sum39$i$i) + ($719))|0;
           $749 = (($tbase$255$i) + ($$sum125$i)|0);
           $750 = HEAP32[$749>>2]|0;
           $751 = $745 << 1;
           $752 = (8328 + ($751<<2)|0);
           $753 = ($748|0)==($752|0);
           do {
            if (!($753)) {
             $754 = ($748>>>0)<($755>>>0);
             if ($754) {
              _abort();
              // unreachable;
             }
             $756 = ((($748)) + 12|0);
             $757 = HEAP32[$756>>2]|0;
             $758 = ($757|0)==($720|0);
             if ($758) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $759 = ($750|0)==($748|0);
           if ($759) {
            $760 = 1 << $745;
            $761 = $760 ^ -1;
            $762 = HEAP32[8288>>2]|0;
            $763 = $762 & $761;
            HEAP32[8288>>2] = $763;
            break;
           }
           $764 = ($750|0)==($752|0);
           do {
            if ($764) {
             $$pre57$i$i = ((($750)) + 8|0);
             $$pre$phi58$i$iZ2D = $$pre57$i$i;
            } else {
             $765 = ($750>>>0)<($755>>>0);
             if ($765) {
              _abort();
              // unreachable;
             }
             $766 = ((($750)) + 8|0);
             $767 = HEAP32[$766>>2]|0;
             $768 = ($767|0)==($720|0);
             if ($768) {
              $$pre$phi58$i$iZ2D = $766;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $769 = ((($748)) + 12|0);
           HEAP32[$769>>2] = $750;
           HEAP32[$$pre$phi58$i$iZ2D>>2] = $748;
          } else {
           $$sum34$i$i = $719 | 24;
           $$sum115$i = (($$sum34$i$i) + ($tsize$254$i))|0;
           $770 = (($tbase$255$i) + ($$sum115$i)|0);
           $771 = HEAP32[$770>>2]|0;
           $$sum5$i$i = (($tsize$254$i) + 12)|0;
           $$sum116$i = (($$sum5$i$i) + ($719))|0;
           $772 = (($tbase$255$i) + ($$sum116$i)|0);
           $773 = HEAP32[$772>>2]|0;
           $774 = ($773|0)==($720|0);
           do {
            if ($774) {
             $$sum67$i$i = $719 | 16;
             $$sum122$i = (($$sum2$i21$i) + ($$sum67$i$i))|0;
             $784 = (($tbase$255$i) + ($$sum122$i)|0);
             $785 = HEAP32[$784>>2]|0;
             $786 = ($785|0)==(0|0);
             if ($786) {
              $$sum123$i = (($$sum67$i$i) + ($tsize$254$i))|0;
              $787 = (($tbase$255$i) + ($$sum123$i)|0);
              $788 = HEAP32[$787>>2]|0;
              $789 = ($788|0)==(0|0);
              if ($789) {
               $R$1$i$i = 0;
               break;
              } else {
               $R$0$i$i = $788;$RP$0$i$i = $787;
              }
             } else {
              $R$0$i$i = $785;$RP$0$i$i = $784;
             }
             while(1) {
              $790 = ((($R$0$i$i)) + 20|0);
              $791 = HEAP32[$790>>2]|0;
              $792 = ($791|0)==(0|0);
              if (!($792)) {
               $R$0$i$i = $791;$RP$0$i$i = $790;
               continue;
              }
              $793 = ((($R$0$i$i)) + 16|0);
              $794 = HEAP32[$793>>2]|0;
              $795 = ($794|0)==(0|0);
              if ($795) {
               $R$0$i$i$lcssa = $R$0$i$i;$RP$0$i$i$lcssa = $RP$0$i$i;
               break;
              } else {
               $R$0$i$i = $794;$RP$0$i$i = $793;
              }
             }
             $796 = ($RP$0$i$i$lcssa>>>0)<($755>>>0);
             if ($796) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$0$i$i$lcssa>>2] = 0;
              $R$1$i$i = $R$0$i$i$lcssa;
              break;
             }
            } else {
             $$sum3536$i$i = $719 | 8;
             $$sum117$i = (($$sum3536$i$i) + ($tsize$254$i))|0;
             $775 = (($tbase$255$i) + ($$sum117$i)|0);
             $776 = HEAP32[$775>>2]|0;
             $777 = ($776>>>0)<($755>>>0);
             if ($777) {
              _abort();
              // unreachable;
             }
             $778 = ((($776)) + 12|0);
             $779 = HEAP32[$778>>2]|0;
             $780 = ($779|0)==($720|0);
             if (!($780)) {
              _abort();
              // unreachable;
             }
             $781 = ((($773)) + 8|0);
             $782 = HEAP32[$781>>2]|0;
             $783 = ($782|0)==($720|0);
             if ($783) {
              HEAP32[$778>>2] = $773;
              HEAP32[$781>>2] = $776;
              $R$1$i$i = $773;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $797 = ($771|0)==(0|0);
           if ($797) {
            break;
           }
           $$sum30$i$i = (($tsize$254$i) + 28)|0;
           $$sum118$i = (($$sum30$i$i) + ($719))|0;
           $798 = (($tbase$255$i) + ($$sum118$i)|0);
           $799 = HEAP32[$798>>2]|0;
           $800 = (8592 + ($799<<2)|0);
           $801 = HEAP32[$800>>2]|0;
           $802 = ($720|0)==($801|0);
           do {
            if ($802) {
             HEAP32[$800>>2] = $R$1$i$i;
             $cond$i$i = ($R$1$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $803 = 1 << $799;
             $804 = $803 ^ -1;
             $805 = HEAP32[(8292)>>2]|0;
             $806 = $805 & $804;
             HEAP32[(8292)>>2] = $806;
             break L332;
            } else {
             $807 = HEAP32[(8304)>>2]|0;
             $808 = ($771>>>0)<($807>>>0);
             if ($808) {
              _abort();
              // unreachable;
             }
             $809 = ((($771)) + 16|0);
             $810 = HEAP32[$809>>2]|0;
             $811 = ($810|0)==($720|0);
             if ($811) {
              HEAP32[$809>>2] = $R$1$i$i;
             } else {
              $812 = ((($771)) + 20|0);
              HEAP32[$812>>2] = $R$1$i$i;
             }
             $813 = ($R$1$i$i|0)==(0|0);
             if ($813) {
              break L332;
             }
            }
           } while(0);
           $814 = HEAP32[(8304)>>2]|0;
           $815 = ($R$1$i$i>>>0)<($814>>>0);
           if ($815) {
            _abort();
            // unreachable;
           }
           $816 = ((($R$1$i$i)) + 24|0);
           HEAP32[$816>>2] = $771;
           $$sum3132$i$i = $719 | 16;
           $$sum119$i = (($$sum3132$i$i) + ($tsize$254$i))|0;
           $817 = (($tbase$255$i) + ($$sum119$i)|0);
           $818 = HEAP32[$817>>2]|0;
           $819 = ($818|0)==(0|0);
           do {
            if (!($819)) {
             $820 = ($818>>>0)<($814>>>0);
             if ($820) {
              _abort();
              // unreachable;
             } else {
              $821 = ((($R$1$i$i)) + 16|0);
              HEAP32[$821>>2] = $818;
              $822 = ((($818)) + 24|0);
              HEAP32[$822>>2] = $R$1$i$i;
              break;
             }
            }
           } while(0);
           $$sum120$i = (($$sum2$i21$i) + ($$sum3132$i$i))|0;
           $823 = (($tbase$255$i) + ($$sum120$i)|0);
           $824 = HEAP32[$823>>2]|0;
           $825 = ($824|0)==(0|0);
           if ($825) {
            break;
           }
           $826 = HEAP32[(8304)>>2]|0;
           $827 = ($824>>>0)<($826>>>0);
           if ($827) {
            _abort();
            // unreachable;
           } else {
            $828 = ((($R$1$i$i)) + 20|0);
            HEAP32[$828>>2] = $824;
            $829 = ((($824)) + 24|0);
            HEAP32[$829>>2] = $R$1$i$i;
            break;
           }
          }
         } while(0);
         $$sum9$i$i = $744 | $719;
         $$sum121$i = (($$sum9$i$i) + ($tsize$254$i))|0;
         $830 = (($tbase$255$i) + ($$sum121$i)|0);
         $831 = (($744) + ($725))|0;
         $oldfirst$0$i$i = $830;$qsize$0$i$i = $831;
        } else {
         $oldfirst$0$i$i = $720;$qsize$0$i$i = $725;
        }
        $832 = ((($oldfirst$0$i$i)) + 4|0);
        $833 = HEAP32[$832>>2]|0;
        $834 = $833 & -2;
        HEAP32[$832>>2] = $834;
        $835 = $qsize$0$i$i | 1;
        $$sum10$i$i = (($$sum$i19$i) + 4)|0;
        $836 = (($tbase$255$i) + ($$sum10$i$i)|0);
        HEAP32[$836>>2] = $835;
        $$sum11$i$i = (($qsize$0$i$i) + ($$sum$i19$i))|0;
        $837 = (($tbase$255$i) + ($$sum11$i$i)|0);
        HEAP32[$837>>2] = $qsize$0$i$i;
        $838 = $qsize$0$i$i >>> 3;
        $839 = ($qsize$0$i$i>>>0)<(256);
        if ($839) {
         $840 = $838 << 1;
         $841 = (8328 + ($840<<2)|0);
         $842 = HEAP32[8288>>2]|0;
         $843 = 1 << $838;
         $844 = $842 & $843;
         $845 = ($844|0)==(0);
         do {
          if ($845) {
           $846 = $842 | $843;
           HEAP32[8288>>2] = $846;
           $$pre$i22$i = (($840) + 2)|0;
           $$pre56$i$i = (8328 + ($$pre$i22$i<<2)|0);
           $$pre$phi$i23$iZ2D = $$pre56$i$i;$F4$0$i$i = $841;
          } else {
           $$sum29$i$i = (($840) + 2)|0;
           $847 = (8328 + ($$sum29$i$i<<2)|0);
           $848 = HEAP32[$847>>2]|0;
           $849 = HEAP32[(8304)>>2]|0;
           $850 = ($848>>>0)<($849>>>0);
           if (!($850)) {
            $$pre$phi$i23$iZ2D = $847;$F4$0$i$i = $848;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i23$iZ2D>>2] = $724;
         $851 = ((($F4$0$i$i)) + 12|0);
         HEAP32[$851>>2] = $724;
         $$sum27$i$i = (($$sum$i19$i) + 8)|0;
         $852 = (($tbase$255$i) + ($$sum27$i$i)|0);
         HEAP32[$852>>2] = $F4$0$i$i;
         $$sum28$i$i = (($$sum$i19$i) + 12)|0;
         $853 = (($tbase$255$i) + ($$sum28$i$i)|0);
         HEAP32[$853>>2] = $841;
         break;
        }
        $854 = $qsize$0$i$i >>> 8;
        $855 = ($854|0)==(0);
        do {
         if ($855) {
          $I7$0$i$i = 0;
         } else {
          $856 = ($qsize$0$i$i>>>0)>(16777215);
          if ($856) {
           $I7$0$i$i = 31;
           break;
          }
          $857 = (($854) + 1048320)|0;
          $858 = $857 >>> 16;
          $859 = $858 & 8;
          $860 = $854 << $859;
          $861 = (($860) + 520192)|0;
          $862 = $861 >>> 16;
          $863 = $862 & 4;
          $864 = $863 | $859;
          $865 = $860 << $863;
          $866 = (($865) + 245760)|0;
          $867 = $866 >>> 16;
          $868 = $867 & 2;
          $869 = $864 | $868;
          $870 = (14 - ($869))|0;
          $871 = $865 << $868;
          $872 = $871 >>> 15;
          $873 = (($870) + ($872))|0;
          $874 = $873 << 1;
          $875 = (($873) + 7)|0;
          $876 = $qsize$0$i$i >>> $875;
          $877 = $876 & 1;
          $878 = $877 | $874;
          $I7$0$i$i = $878;
         }
        } while(0);
        $879 = (8592 + ($I7$0$i$i<<2)|0);
        $$sum12$i$i = (($$sum$i19$i) + 28)|0;
        $880 = (($tbase$255$i) + ($$sum12$i$i)|0);
        HEAP32[$880>>2] = $I7$0$i$i;
        $$sum13$i$i = (($$sum$i19$i) + 16)|0;
        $881 = (($tbase$255$i) + ($$sum13$i$i)|0);
        $$sum14$i$i = (($$sum$i19$i) + 20)|0;
        $882 = (($tbase$255$i) + ($$sum14$i$i)|0);
        HEAP32[$882>>2] = 0;
        HEAP32[$881>>2] = 0;
        $883 = HEAP32[(8292)>>2]|0;
        $884 = 1 << $I7$0$i$i;
        $885 = $883 & $884;
        $886 = ($885|0)==(0);
        if ($886) {
         $887 = $883 | $884;
         HEAP32[(8292)>>2] = $887;
         HEAP32[$879>>2] = $724;
         $$sum15$i$i = (($$sum$i19$i) + 24)|0;
         $888 = (($tbase$255$i) + ($$sum15$i$i)|0);
         HEAP32[$888>>2] = $879;
         $$sum16$i$i = (($$sum$i19$i) + 12)|0;
         $889 = (($tbase$255$i) + ($$sum16$i$i)|0);
         HEAP32[$889>>2] = $724;
         $$sum17$i$i = (($$sum$i19$i) + 8)|0;
         $890 = (($tbase$255$i) + ($$sum17$i$i)|0);
         HEAP32[$890>>2] = $724;
         break;
        }
        $891 = HEAP32[$879>>2]|0;
        $892 = ((($891)) + 4|0);
        $893 = HEAP32[$892>>2]|0;
        $894 = $893 & -8;
        $895 = ($894|0)==($qsize$0$i$i|0);
        L418: do {
         if ($895) {
          $T$0$lcssa$i25$i = $891;
         } else {
          $896 = ($I7$0$i$i|0)==(31);
          $897 = $I7$0$i$i >>> 1;
          $898 = (25 - ($897))|0;
          $899 = $896 ? 0 : $898;
          $900 = $qsize$0$i$i << $899;
          $K8$051$i$i = $900;$T$050$i$i = $891;
          while(1) {
           $907 = $K8$051$i$i >>> 31;
           $908 = (((($T$050$i$i)) + 16|0) + ($907<<2)|0);
           $903 = HEAP32[$908>>2]|0;
           $909 = ($903|0)==(0|0);
           if ($909) {
            $$lcssa = $908;$T$050$i$i$lcssa = $T$050$i$i;
            break;
           }
           $901 = $K8$051$i$i << 1;
           $902 = ((($903)) + 4|0);
           $904 = HEAP32[$902>>2]|0;
           $905 = $904 & -8;
           $906 = ($905|0)==($qsize$0$i$i|0);
           if ($906) {
            $T$0$lcssa$i25$i = $903;
            break L418;
           } else {
            $K8$051$i$i = $901;$T$050$i$i = $903;
           }
          }
          $910 = HEAP32[(8304)>>2]|0;
          $911 = ($$lcssa>>>0)<($910>>>0);
          if ($911) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$$lcssa>>2] = $724;
           $$sum23$i$i = (($$sum$i19$i) + 24)|0;
           $912 = (($tbase$255$i) + ($$sum23$i$i)|0);
           HEAP32[$912>>2] = $T$050$i$i$lcssa;
           $$sum24$i$i = (($$sum$i19$i) + 12)|0;
           $913 = (($tbase$255$i) + ($$sum24$i$i)|0);
           HEAP32[$913>>2] = $724;
           $$sum25$i$i = (($$sum$i19$i) + 8)|0;
           $914 = (($tbase$255$i) + ($$sum25$i$i)|0);
           HEAP32[$914>>2] = $724;
           break L324;
          }
         }
        } while(0);
        $915 = ((($T$0$lcssa$i25$i)) + 8|0);
        $916 = HEAP32[$915>>2]|0;
        $917 = HEAP32[(8304)>>2]|0;
        $918 = ($916>>>0)>=($917>>>0);
        $not$$i26$i = ($T$0$lcssa$i25$i>>>0)>=($917>>>0);
        $919 = $918 & $not$$i26$i;
        if ($919) {
         $920 = ((($916)) + 12|0);
         HEAP32[$920>>2] = $724;
         HEAP32[$915>>2] = $724;
         $$sum20$i$i = (($$sum$i19$i) + 8)|0;
         $921 = (($tbase$255$i) + ($$sum20$i$i)|0);
         HEAP32[$921>>2] = $916;
         $$sum21$i$i = (($$sum$i19$i) + 12)|0;
         $922 = (($tbase$255$i) + ($$sum21$i$i)|0);
         HEAP32[$922>>2] = $T$0$lcssa$i25$i;
         $$sum22$i$i = (($$sum$i19$i) + 24)|0;
         $923 = (($tbase$255$i) + ($$sum22$i$i)|0);
         HEAP32[$923>>2] = 0;
         break;
        } else {
         _abort();
         // unreachable;
        }
       }
      } while(0);
      $$sum1819$i$i = $711 | 8;
      $924 = (($tbase$255$i) + ($$sum1819$i$i)|0);
      $mem$0 = $924;
      return ($mem$0|0);
     } else {
      $sp$0$i$i$i = (8736);
     }
    }
    while(1) {
     $925 = HEAP32[$sp$0$i$i$i>>2]|0;
     $926 = ($925>>>0)>($635>>>0);
     if (!($926)) {
      $927 = ((($sp$0$i$i$i)) + 4|0);
      $928 = HEAP32[$927>>2]|0;
      $929 = (($925) + ($928)|0);
      $930 = ($929>>>0)>($635>>>0);
      if ($930) {
       $$lcssa215 = $925;$$lcssa216 = $928;$$lcssa217 = $929;
       break;
      }
     }
     $931 = ((($sp$0$i$i$i)) + 8|0);
     $932 = HEAP32[$931>>2]|0;
     $sp$0$i$i$i = $932;
    }
    $$sum$i14$i = (($$lcssa216) + -47)|0;
    $$sum1$i15$i = (($$lcssa216) + -39)|0;
    $933 = (($$lcssa215) + ($$sum1$i15$i)|0);
    $934 = $933;
    $935 = $934 & 7;
    $936 = ($935|0)==(0);
    $937 = (0 - ($934))|0;
    $938 = $937 & 7;
    $939 = $936 ? 0 : $938;
    $$sum2$i16$i = (($$sum$i14$i) + ($939))|0;
    $940 = (($$lcssa215) + ($$sum2$i16$i)|0);
    $941 = ((($635)) + 16|0);
    $942 = ($940>>>0)<($941>>>0);
    $943 = $942 ? $635 : $940;
    $944 = ((($943)) + 8|0);
    $945 = (($tsize$254$i) + -40)|0;
    $946 = ((($tbase$255$i)) + 8|0);
    $947 = $946;
    $948 = $947 & 7;
    $949 = ($948|0)==(0);
    $950 = (0 - ($947))|0;
    $951 = $950 & 7;
    $952 = $949 ? 0 : $951;
    $953 = (($tbase$255$i) + ($952)|0);
    $954 = (($945) - ($952))|0;
    HEAP32[(8312)>>2] = $953;
    HEAP32[(8300)>>2] = $954;
    $955 = $954 | 1;
    $$sum$i$i$i = (($952) + 4)|0;
    $956 = (($tbase$255$i) + ($$sum$i$i$i)|0);
    HEAP32[$956>>2] = $955;
    $$sum2$i$i$i = (($tsize$254$i) + -36)|0;
    $957 = (($tbase$255$i) + ($$sum2$i$i$i)|0);
    HEAP32[$957>>2] = 40;
    $958 = HEAP32[(8776)>>2]|0;
    HEAP32[(8316)>>2] = $958;
    $959 = ((($943)) + 4|0);
    HEAP32[$959>>2] = 27;
    ;HEAP32[$944>>2]=HEAP32[(8736)>>2]|0;HEAP32[$944+4>>2]=HEAP32[(8736)+4>>2]|0;HEAP32[$944+8>>2]=HEAP32[(8736)+8>>2]|0;HEAP32[$944+12>>2]=HEAP32[(8736)+12>>2]|0;
    HEAP32[(8736)>>2] = $tbase$255$i;
    HEAP32[(8740)>>2] = $tsize$254$i;
    HEAP32[(8748)>>2] = 0;
    HEAP32[(8744)>>2] = $944;
    $960 = ((($943)) + 28|0);
    HEAP32[$960>>2] = 7;
    $961 = ((($943)) + 32|0);
    $962 = ($961>>>0)<($$lcssa217>>>0);
    if ($962) {
     $964 = $960;
     while(1) {
      $963 = ((($964)) + 4|0);
      HEAP32[$963>>2] = 7;
      $965 = ((($964)) + 8|0);
      $966 = ($965>>>0)<($$lcssa217>>>0);
      if ($966) {
       $964 = $963;
      } else {
       break;
      }
     }
    }
    $967 = ($943|0)==($635|0);
    if (!($967)) {
     $968 = $943;
     $969 = $635;
     $970 = (($968) - ($969))|0;
     $971 = HEAP32[$959>>2]|0;
     $972 = $971 & -2;
     HEAP32[$959>>2] = $972;
     $973 = $970 | 1;
     $974 = ((($635)) + 4|0);
     HEAP32[$974>>2] = $973;
     HEAP32[$943>>2] = $970;
     $975 = $970 >>> 3;
     $976 = ($970>>>0)<(256);
     if ($976) {
      $977 = $975 << 1;
      $978 = (8328 + ($977<<2)|0);
      $979 = HEAP32[8288>>2]|0;
      $980 = 1 << $975;
      $981 = $979 & $980;
      $982 = ($981|0)==(0);
      if ($982) {
       $983 = $979 | $980;
       HEAP32[8288>>2] = $983;
       $$pre$i$i = (($977) + 2)|0;
       $$pre14$i$i = (8328 + ($$pre$i$i<<2)|0);
       $$pre$phi$i$iZ2D = $$pre14$i$i;$F$0$i$i = $978;
      } else {
       $$sum4$i$i = (($977) + 2)|0;
       $984 = (8328 + ($$sum4$i$i<<2)|0);
       $985 = HEAP32[$984>>2]|0;
       $986 = HEAP32[(8304)>>2]|0;
       $987 = ($985>>>0)<($986>>>0);
       if ($987) {
        _abort();
        // unreachable;
       } else {
        $$pre$phi$i$iZ2D = $984;$F$0$i$i = $985;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $635;
      $988 = ((($F$0$i$i)) + 12|0);
      HEAP32[$988>>2] = $635;
      $989 = ((($635)) + 8|0);
      HEAP32[$989>>2] = $F$0$i$i;
      $990 = ((($635)) + 12|0);
      HEAP32[$990>>2] = $978;
      break;
     }
     $991 = $970 >>> 8;
     $992 = ($991|0)==(0);
     if ($992) {
      $I1$0$i$i = 0;
     } else {
      $993 = ($970>>>0)>(16777215);
      if ($993) {
       $I1$0$i$i = 31;
      } else {
       $994 = (($991) + 1048320)|0;
       $995 = $994 >>> 16;
       $996 = $995 & 8;
       $997 = $991 << $996;
       $998 = (($997) + 520192)|0;
       $999 = $998 >>> 16;
       $1000 = $999 & 4;
       $1001 = $1000 | $996;
       $1002 = $997 << $1000;
       $1003 = (($1002) + 245760)|0;
       $1004 = $1003 >>> 16;
       $1005 = $1004 & 2;
       $1006 = $1001 | $1005;
       $1007 = (14 - ($1006))|0;
       $1008 = $1002 << $1005;
       $1009 = $1008 >>> 15;
       $1010 = (($1007) + ($1009))|0;
       $1011 = $1010 << 1;
       $1012 = (($1010) + 7)|0;
       $1013 = $970 >>> $1012;
       $1014 = $1013 & 1;
       $1015 = $1014 | $1011;
       $I1$0$i$i = $1015;
      }
     }
     $1016 = (8592 + ($I1$0$i$i<<2)|0);
     $1017 = ((($635)) + 28|0);
     HEAP32[$1017>>2] = $I1$0$i$i;
     $1018 = ((($635)) + 20|0);
     HEAP32[$1018>>2] = 0;
     HEAP32[$941>>2] = 0;
     $1019 = HEAP32[(8292)>>2]|0;
     $1020 = 1 << $I1$0$i$i;
     $1021 = $1019 & $1020;
     $1022 = ($1021|0)==(0);
     if ($1022) {
      $1023 = $1019 | $1020;
      HEAP32[(8292)>>2] = $1023;
      HEAP32[$1016>>2] = $635;
      $1024 = ((($635)) + 24|0);
      HEAP32[$1024>>2] = $1016;
      $1025 = ((($635)) + 12|0);
      HEAP32[$1025>>2] = $635;
      $1026 = ((($635)) + 8|0);
      HEAP32[$1026>>2] = $635;
      break;
     }
     $1027 = HEAP32[$1016>>2]|0;
     $1028 = ((($1027)) + 4|0);
     $1029 = HEAP32[$1028>>2]|0;
     $1030 = $1029 & -8;
     $1031 = ($1030|0)==($970|0);
     L459: do {
      if ($1031) {
       $T$0$lcssa$i$i = $1027;
      } else {
       $1032 = ($I1$0$i$i|0)==(31);
       $1033 = $I1$0$i$i >>> 1;
       $1034 = (25 - ($1033))|0;
       $1035 = $1032 ? 0 : $1034;
       $1036 = $970 << $1035;
       $K2$07$i$i = $1036;$T$06$i$i = $1027;
       while(1) {
        $1043 = $K2$07$i$i >>> 31;
        $1044 = (((($T$06$i$i)) + 16|0) + ($1043<<2)|0);
        $1039 = HEAP32[$1044>>2]|0;
        $1045 = ($1039|0)==(0|0);
        if ($1045) {
         $$lcssa211 = $1044;$T$06$i$i$lcssa = $T$06$i$i;
         break;
        }
        $1037 = $K2$07$i$i << 1;
        $1038 = ((($1039)) + 4|0);
        $1040 = HEAP32[$1038>>2]|0;
        $1041 = $1040 & -8;
        $1042 = ($1041|0)==($970|0);
        if ($1042) {
         $T$0$lcssa$i$i = $1039;
         break L459;
        } else {
         $K2$07$i$i = $1037;$T$06$i$i = $1039;
        }
       }
       $1046 = HEAP32[(8304)>>2]|0;
       $1047 = ($$lcssa211>>>0)<($1046>>>0);
       if ($1047) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$lcssa211>>2] = $635;
        $1048 = ((($635)) + 24|0);
        HEAP32[$1048>>2] = $T$06$i$i$lcssa;
        $1049 = ((($635)) + 12|0);
        HEAP32[$1049>>2] = $635;
        $1050 = ((($635)) + 8|0);
        HEAP32[$1050>>2] = $635;
        break L299;
       }
      }
     } while(0);
     $1051 = ((($T$0$lcssa$i$i)) + 8|0);
     $1052 = HEAP32[$1051>>2]|0;
     $1053 = HEAP32[(8304)>>2]|0;
     $1054 = ($1052>>>0)>=($1053>>>0);
     $not$$i$i = ($T$0$lcssa$i$i>>>0)>=($1053>>>0);
     $1055 = $1054 & $not$$i$i;
     if ($1055) {
      $1056 = ((($1052)) + 12|0);
      HEAP32[$1056>>2] = $635;
      HEAP32[$1051>>2] = $635;
      $1057 = ((($635)) + 8|0);
      HEAP32[$1057>>2] = $1052;
      $1058 = ((($635)) + 12|0);
      HEAP32[$1058>>2] = $T$0$lcssa$i$i;
      $1059 = ((($635)) + 24|0);
      HEAP32[$1059>>2] = 0;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   }
  } while(0);
  $1060 = HEAP32[(8300)>>2]|0;
  $1061 = ($1060>>>0)>($nb$0>>>0);
  if ($1061) {
   $1062 = (($1060) - ($nb$0))|0;
   HEAP32[(8300)>>2] = $1062;
   $1063 = HEAP32[(8312)>>2]|0;
   $1064 = (($1063) + ($nb$0)|0);
   HEAP32[(8312)>>2] = $1064;
   $1065 = $1062 | 1;
   $$sum$i32 = (($nb$0) + 4)|0;
   $1066 = (($1063) + ($$sum$i32)|0);
   HEAP32[$1066>>2] = $1065;
   $1067 = $nb$0 | 3;
   $1068 = ((($1063)) + 4|0);
   HEAP32[$1068>>2] = $1067;
   $1069 = ((($1063)) + 8|0);
   $mem$0 = $1069;
   return ($mem$0|0);
  }
 }
 $1070 = (___errno_location()|0);
 HEAP32[$1070>>2] = 12;
 $mem$0 = 0;
 return ($mem$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$lcssa = 0, $$pre = 0, $$pre$phi59Z2D = 0, $$pre$phi61Z2D = 0, $$pre$phiZ2D = 0, $$pre57 = 0, $$pre58 = 0, $$pre60 = 0, $$sum = 0, $$sum11 = 0, $$sum12 = 0, $$sum13 = 0, $$sum14 = 0, $$sum1718 = 0, $$sum19 = 0, $$sum2 = 0, $$sum20 = 0, $$sum22 = 0, $$sum23 = 0, $$sum24 = 0;
 var $$sum25 = 0, $$sum26 = 0, $$sum27 = 0, $$sum28 = 0, $$sum29 = 0, $$sum3 = 0, $$sum30 = 0, $$sum31 = 0, $$sum5 = 0, $$sum67 = 0, $$sum8 = 0, $$sum9 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0;
 var $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0;
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0;
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0;
 var $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0;
 var $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0;
 var $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F16$0 = 0, $I18$0 = 0, $K19$052 = 0, $R$0 = 0, $R$0$lcssa = 0, $R$1 = 0;
 var $R7$0 = 0, $R7$0$lcssa = 0, $R7$1 = 0, $RP$0 = 0, $RP$0$lcssa = 0, $RP9$0 = 0, $RP9$0$lcssa = 0, $T$0$lcssa = 0, $T$051 = 0, $T$051$lcssa = 0, $cond = 0, $cond47 = 0, $not$ = 0, $p$0 = 0, $psize$0 = 0, $psize$1 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($mem|0)==(0|0);
 if ($0) {
  return;
 }
 $1 = ((($mem)) + -8|0);
 $2 = HEAP32[(8304)>>2]|0;
 $3 = ($1>>>0)<($2>>>0);
 if ($3) {
  _abort();
  // unreachable;
 }
 $4 = ((($mem)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & 3;
 $7 = ($6|0)==(1);
 if ($7) {
  _abort();
  // unreachable;
 }
 $8 = $5 & -8;
 $$sum = (($8) + -8)|0;
 $9 = (($mem) + ($$sum)|0);
 $10 = $5 & 1;
 $11 = ($10|0)==(0);
 do {
  if ($11) {
   $12 = HEAP32[$1>>2]|0;
   $13 = ($6|0)==(0);
   if ($13) {
    return;
   }
   $$sum2 = (-8 - ($12))|0;
   $14 = (($mem) + ($$sum2)|0);
   $15 = (($12) + ($8))|0;
   $16 = ($14>>>0)<($2>>>0);
   if ($16) {
    _abort();
    // unreachable;
   }
   $17 = HEAP32[(8308)>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $$sum3 = (($8) + -4)|0;
    $103 = (($mem) + ($$sum3)|0);
    $104 = HEAP32[$103>>2]|0;
    $105 = $104 & 3;
    $106 = ($105|0)==(3);
    if (!($106)) {
     $p$0 = $14;$psize$0 = $15;
     break;
    }
    HEAP32[(8296)>>2] = $15;
    $107 = $104 & -2;
    HEAP32[$103>>2] = $107;
    $108 = $15 | 1;
    $$sum20 = (($$sum2) + 4)|0;
    $109 = (($mem) + ($$sum20)|0);
    HEAP32[$109>>2] = $108;
    HEAP32[$9>>2] = $15;
    return;
   }
   $19 = $12 >>> 3;
   $20 = ($12>>>0)<(256);
   if ($20) {
    $$sum30 = (($$sum2) + 8)|0;
    $21 = (($mem) + ($$sum30)|0);
    $22 = HEAP32[$21>>2]|0;
    $$sum31 = (($$sum2) + 12)|0;
    $23 = (($mem) + ($$sum31)|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = $19 << 1;
    $26 = (8328 + ($25<<2)|0);
    $27 = ($22|0)==($26|0);
    if (!($27)) {
     $28 = ($22>>>0)<($2>>>0);
     if ($28) {
      _abort();
      // unreachable;
     }
     $29 = ((($22)) + 12|0);
     $30 = HEAP32[$29>>2]|0;
     $31 = ($30|0)==($14|0);
     if (!($31)) {
      _abort();
      // unreachable;
     }
    }
    $32 = ($24|0)==($22|0);
    if ($32) {
     $33 = 1 << $19;
     $34 = $33 ^ -1;
     $35 = HEAP32[8288>>2]|0;
     $36 = $35 & $34;
     HEAP32[8288>>2] = $36;
     $p$0 = $14;$psize$0 = $15;
     break;
    }
    $37 = ($24|0)==($26|0);
    if ($37) {
     $$pre60 = ((($24)) + 8|0);
     $$pre$phi61Z2D = $$pre60;
    } else {
     $38 = ($24>>>0)<($2>>>0);
     if ($38) {
      _abort();
      // unreachable;
     }
     $39 = ((($24)) + 8|0);
     $40 = HEAP32[$39>>2]|0;
     $41 = ($40|0)==($14|0);
     if ($41) {
      $$pre$phi61Z2D = $39;
     } else {
      _abort();
      // unreachable;
     }
    }
    $42 = ((($22)) + 12|0);
    HEAP32[$42>>2] = $24;
    HEAP32[$$pre$phi61Z2D>>2] = $22;
    $p$0 = $14;$psize$0 = $15;
    break;
   }
   $$sum22 = (($$sum2) + 24)|0;
   $43 = (($mem) + ($$sum22)|0);
   $44 = HEAP32[$43>>2]|0;
   $$sum23 = (($$sum2) + 12)|0;
   $45 = (($mem) + ($$sum23)|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ($46|0)==($14|0);
   do {
    if ($47) {
     $$sum25 = (($$sum2) + 20)|0;
     $57 = (($mem) + ($$sum25)|0);
     $58 = HEAP32[$57>>2]|0;
     $59 = ($58|0)==(0|0);
     if ($59) {
      $$sum24 = (($$sum2) + 16)|0;
      $60 = (($mem) + ($$sum24)|0);
      $61 = HEAP32[$60>>2]|0;
      $62 = ($61|0)==(0|0);
      if ($62) {
       $R$1 = 0;
       break;
      } else {
       $R$0 = $61;$RP$0 = $60;
      }
     } else {
      $R$0 = $58;$RP$0 = $57;
     }
     while(1) {
      $63 = ((($R$0)) + 20|0);
      $64 = HEAP32[$63>>2]|0;
      $65 = ($64|0)==(0|0);
      if (!($65)) {
       $R$0 = $64;$RP$0 = $63;
       continue;
      }
      $66 = ((($R$0)) + 16|0);
      $67 = HEAP32[$66>>2]|0;
      $68 = ($67|0)==(0|0);
      if ($68) {
       $R$0$lcssa = $R$0;$RP$0$lcssa = $RP$0;
       break;
      } else {
       $R$0 = $67;$RP$0 = $66;
      }
     }
     $69 = ($RP$0$lcssa>>>0)<($2>>>0);
     if ($69) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$0$lcssa>>2] = 0;
      $R$1 = $R$0$lcssa;
      break;
     }
    } else {
     $$sum29 = (($$sum2) + 8)|0;
     $48 = (($mem) + ($$sum29)|0);
     $49 = HEAP32[$48>>2]|0;
     $50 = ($49>>>0)<($2>>>0);
     if ($50) {
      _abort();
      // unreachable;
     }
     $51 = ((($49)) + 12|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = ($52|0)==($14|0);
     if (!($53)) {
      _abort();
      // unreachable;
     }
     $54 = ((($46)) + 8|0);
     $55 = HEAP32[$54>>2]|0;
     $56 = ($55|0)==($14|0);
     if ($56) {
      HEAP32[$51>>2] = $46;
      HEAP32[$54>>2] = $49;
      $R$1 = $46;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $70 = ($44|0)==(0|0);
   if ($70) {
    $p$0 = $14;$psize$0 = $15;
   } else {
    $$sum26 = (($$sum2) + 28)|0;
    $71 = (($mem) + ($$sum26)|0);
    $72 = HEAP32[$71>>2]|0;
    $73 = (8592 + ($72<<2)|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($14|0)==($74|0);
    if ($75) {
     HEAP32[$73>>2] = $R$1;
     $cond = ($R$1|0)==(0|0);
     if ($cond) {
      $76 = 1 << $72;
      $77 = $76 ^ -1;
      $78 = HEAP32[(8292)>>2]|0;
      $79 = $78 & $77;
      HEAP32[(8292)>>2] = $79;
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    } else {
     $80 = HEAP32[(8304)>>2]|0;
     $81 = ($44>>>0)<($80>>>0);
     if ($81) {
      _abort();
      // unreachable;
     }
     $82 = ((($44)) + 16|0);
     $83 = HEAP32[$82>>2]|0;
     $84 = ($83|0)==($14|0);
     if ($84) {
      HEAP32[$82>>2] = $R$1;
     } else {
      $85 = ((($44)) + 20|0);
      HEAP32[$85>>2] = $R$1;
     }
     $86 = ($R$1|0)==(0|0);
     if ($86) {
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    }
    $87 = HEAP32[(8304)>>2]|0;
    $88 = ($R$1>>>0)<($87>>>0);
    if ($88) {
     _abort();
     // unreachable;
    }
    $89 = ((($R$1)) + 24|0);
    HEAP32[$89>>2] = $44;
    $$sum27 = (($$sum2) + 16)|0;
    $90 = (($mem) + ($$sum27)|0);
    $91 = HEAP32[$90>>2]|0;
    $92 = ($91|0)==(0|0);
    do {
     if (!($92)) {
      $93 = ($91>>>0)<($87>>>0);
      if ($93) {
       _abort();
       // unreachable;
      } else {
       $94 = ((($R$1)) + 16|0);
       HEAP32[$94>>2] = $91;
       $95 = ((($91)) + 24|0);
       HEAP32[$95>>2] = $R$1;
       break;
      }
     }
    } while(0);
    $$sum28 = (($$sum2) + 20)|0;
    $96 = (($mem) + ($$sum28)|0);
    $97 = HEAP32[$96>>2]|0;
    $98 = ($97|0)==(0|0);
    if ($98) {
     $p$0 = $14;$psize$0 = $15;
    } else {
     $99 = HEAP32[(8304)>>2]|0;
     $100 = ($97>>>0)<($99>>>0);
     if ($100) {
      _abort();
      // unreachable;
     } else {
      $101 = ((($R$1)) + 20|0);
      HEAP32[$101>>2] = $97;
      $102 = ((($97)) + 24|0);
      HEAP32[$102>>2] = $R$1;
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    }
   }
  } else {
   $p$0 = $1;$psize$0 = $8;
  }
 } while(0);
 $110 = ($p$0>>>0)<($9>>>0);
 if (!($110)) {
  _abort();
  // unreachable;
 }
 $$sum19 = (($8) + -4)|0;
 $111 = (($mem) + ($$sum19)|0);
 $112 = HEAP32[$111>>2]|0;
 $113 = $112 & 1;
 $114 = ($113|0)==(0);
 if ($114) {
  _abort();
  // unreachable;
 }
 $115 = $112 & 2;
 $116 = ($115|0)==(0);
 if ($116) {
  $117 = HEAP32[(8312)>>2]|0;
  $118 = ($9|0)==($117|0);
  if ($118) {
   $119 = HEAP32[(8300)>>2]|0;
   $120 = (($119) + ($psize$0))|0;
   HEAP32[(8300)>>2] = $120;
   HEAP32[(8312)>>2] = $p$0;
   $121 = $120 | 1;
   $122 = ((($p$0)) + 4|0);
   HEAP32[$122>>2] = $121;
   $123 = HEAP32[(8308)>>2]|0;
   $124 = ($p$0|0)==($123|0);
   if (!($124)) {
    return;
   }
   HEAP32[(8308)>>2] = 0;
   HEAP32[(8296)>>2] = 0;
   return;
  }
  $125 = HEAP32[(8308)>>2]|0;
  $126 = ($9|0)==($125|0);
  if ($126) {
   $127 = HEAP32[(8296)>>2]|0;
   $128 = (($127) + ($psize$0))|0;
   HEAP32[(8296)>>2] = $128;
   HEAP32[(8308)>>2] = $p$0;
   $129 = $128 | 1;
   $130 = ((($p$0)) + 4|0);
   HEAP32[$130>>2] = $129;
   $131 = (($p$0) + ($128)|0);
   HEAP32[$131>>2] = $128;
   return;
  }
  $132 = $112 & -8;
  $133 = (($132) + ($psize$0))|0;
  $134 = $112 >>> 3;
  $135 = ($112>>>0)<(256);
  do {
   if ($135) {
    $136 = (($mem) + ($8)|0);
    $137 = HEAP32[$136>>2]|0;
    $$sum1718 = $8 | 4;
    $138 = (($mem) + ($$sum1718)|0);
    $139 = HEAP32[$138>>2]|0;
    $140 = $134 << 1;
    $141 = (8328 + ($140<<2)|0);
    $142 = ($137|0)==($141|0);
    if (!($142)) {
     $143 = HEAP32[(8304)>>2]|0;
     $144 = ($137>>>0)<($143>>>0);
     if ($144) {
      _abort();
      // unreachable;
     }
     $145 = ((($137)) + 12|0);
     $146 = HEAP32[$145>>2]|0;
     $147 = ($146|0)==($9|0);
     if (!($147)) {
      _abort();
      // unreachable;
     }
    }
    $148 = ($139|0)==($137|0);
    if ($148) {
     $149 = 1 << $134;
     $150 = $149 ^ -1;
     $151 = HEAP32[8288>>2]|0;
     $152 = $151 & $150;
     HEAP32[8288>>2] = $152;
     break;
    }
    $153 = ($139|0)==($141|0);
    if ($153) {
     $$pre58 = ((($139)) + 8|0);
     $$pre$phi59Z2D = $$pre58;
    } else {
     $154 = HEAP32[(8304)>>2]|0;
     $155 = ($139>>>0)<($154>>>0);
     if ($155) {
      _abort();
      // unreachable;
     }
     $156 = ((($139)) + 8|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = ($157|0)==($9|0);
     if ($158) {
      $$pre$phi59Z2D = $156;
     } else {
      _abort();
      // unreachable;
     }
    }
    $159 = ((($137)) + 12|0);
    HEAP32[$159>>2] = $139;
    HEAP32[$$pre$phi59Z2D>>2] = $137;
   } else {
    $$sum5 = (($8) + 16)|0;
    $160 = (($mem) + ($$sum5)|0);
    $161 = HEAP32[$160>>2]|0;
    $$sum67 = $8 | 4;
    $162 = (($mem) + ($$sum67)|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = ($163|0)==($9|0);
    do {
     if ($164) {
      $$sum9 = (($8) + 12)|0;
      $175 = (($mem) + ($$sum9)|0);
      $176 = HEAP32[$175>>2]|0;
      $177 = ($176|0)==(0|0);
      if ($177) {
       $$sum8 = (($8) + 8)|0;
       $178 = (($mem) + ($$sum8)|0);
       $179 = HEAP32[$178>>2]|0;
       $180 = ($179|0)==(0|0);
       if ($180) {
        $R7$1 = 0;
        break;
       } else {
        $R7$0 = $179;$RP9$0 = $178;
       }
      } else {
       $R7$0 = $176;$RP9$0 = $175;
      }
      while(1) {
       $181 = ((($R7$0)) + 20|0);
       $182 = HEAP32[$181>>2]|0;
       $183 = ($182|0)==(0|0);
       if (!($183)) {
        $R7$0 = $182;$RP9$0 = $181;
        continue;
       }
       $184 = ((($R7$0)) + 16|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($185|0)==(0|0);
       if ($186) {
        $R7$0$lcssa = $R7$0;$RP9$0$lcssa = $RP9$0;
        break;
       } else {
        $R7$0 = $185;$RP9$0 = $184;
       }
      }
      $187 = HEAP32[(8304)>>2]|0;
      $188 = ($RP9$0$lcssa>>>0)<($187>>>0);
      if ($188) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP9$0$lcssa>>2] = 0;
       $R7$1 = $R7$0$lcssa;
       break;
      }
     } else {
      $165 = (($mem) + ($8)|0);
      $166 = HEAP32[$165>>2]|0;
      $167 = HEAP32[(8304)>>2]|0;
      $168 = ($166>>>0)<($167>>>0);
      if ($168) {
       _abort();
       // unreachable;
      }
      $169 = ((($166)) + 12|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = ($170|0)==($9|0);
      if (!($171)) {
       _abort();
       // unreachable;
      }
      $172 = ((($163)) + 8|0);
      $173 = HEAP32[$172>>2]|0;
      $174 = ($173|0)==($9|0);
      if ($174) {
       HEAP32[$169>>2] = $163;
       HEAP32[$172>>2] = $166;
       $R7$1 = $163;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $189 = ($161|0)==(0|0);
    if (!($189)) {
     $$sum12 = (($8) + 20)|0;
     $190 = (($mem) + ($$sum12)|0);
     $191 = HEAP32[$190>>2]|0;
     $192 = (8592 + ($191<<2)|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = ($9|0)==($193|0);
     if ($194) {
      HEAP32[$192>>2] = $R7$1;
      $cond47 = ($R7$1|0)==(0|0);
      if ($cond47) {
       $195 = 1 << $191;
       $196 = $195 ^ -1;
       $197 = HEAP32[(8292)>>2]|0;
       $198 = $197 & $196;
       HEAP32[(8292)>>2] = $198;
       break;
      }
     } else {
      $199 = HEAP32[(8304)>>2]|0;
      $200 = ($161>>>0)<($199>>>0);
      if ($200) {
       _abort();
       // unreachable;
      }
      $201 = ((($161)) + 16|0);
      $202 = HEAP32[$201>>2]|0;
      $203 = ($202|0)==($9|0);
      if ($203) {
       HEAP32[$201>>2] = $R7$1;
      } else {
       $204 = ((($161)) + 20|0);
       HEAP32[$204>>2] = $R7$1;
      }
      $205 = ($R7$1|0)==(0|0);
      if ($205) {
       break;
      }
     }
     $206 = HEAP32[(8304)>>2]|0;
     $207 = ($R7$1>>>0)<($206>>>0);
     if ($207) {
      _abort();
      // unreachable;
     }
     $208 = ((($R7$1)) + 24|0);
     HEAP32[$208>>2] = $161;
     $$sum13 = (($8) + 8)|0;
     $209 = (($mem) + ($$sum13)|0);
     $210 = HEAP32[$209>>2]|0;
     $211 = ($210|0)==(0|0);
     do {
      if (!($211)) {
       $212 = ($210>>>0)<($206>>>0);
       if ($212) {
        _abort();
        // unreachable;
       } else {
        $213 = ((($R7$1)) + 16|0);
        HEAP32[$213>>2] = $210;
        $214 = ((($210)) + 24|0);
        HEAP32[$214>>2] = $R7$1;
        break;
       }
      }
     } while(0);
     $$sum14 = (($8) + 12)|0;
     $215 = (($mem) + ($$sum14)|0);
     $216 = HEAP32[$215>>2]|0;
     $217 = ($216|0)==(0|0);
     if (!($217)) {
      $218 = HEAP32[(8304)>>2]|0;
      $219 = ($216>>>0)<($218>>>0);
      if ($219) {
       _abort();
       // unreachable;
      } else {
       $220 = ((($R7$1)) + 20|0);
       HEAP32[$220>>2] = $216;
       $221 = ((($216)) + 24|0);
       HEAP32[$221>>2] = $R7$1;
       break;
      }
     }
    }
   }
  } while(0);
  $222 = $133 | 1;
  $223 = ((($p$0)) + 4|0);
  HEAP32[$223>>2] = $222;
  $224 = (($p$0) + ($133)|0);
  HEAP32[$224>>2] = $133;
  $225 = HEAP32[(8308)>>2]|0;
  $226 = ($p$0|0)==($225|0);
  if ($226) {
   HEAP32[(8296)>>2] = $133;
   return;
  } else {
   $psize$1 = $133;
  }
 } else {
  $227 = $112 & -2;
  HEAP32[$111>>2] = $227;
  $228 = $psize$0 | 1;
  $229 = ((($p$0)) + 4|0);
  HEAP32[$229>>2] = $228;
  $230 = (($p$0) + ($psize$0)|0);
  HEAP32[$230>>2] = $psize$0;
  $psize$1 = $psize$0;
 }
 $231 = $psize$1 >>> 3;
 $232 = ($psize$1>>>0)<(256);
 if ($232) {
  $233 = $231 << 1;
  $234 = (8328 + ($233<<2)|0);
  $235 = HEAP32[8288>>2]|0;
  $236 = 1 << $231;
  $237 = $235 & $236;
  $238 = ($237|0)==(0);
  if ($238) {
   $239 = $235 | $236;
   HEAP32[8288>>2] = $239;
   $$pre = (($233) + 2)|0;
   $$pre57 = (8328 + ($$pre<<2)|0);
   $$pre$phiZ2D = $$pre57;$F16$0 = $234;
  } else {
   $$sum11 = (($233) + 2)|0;
   $240 = (8328 + ($$sum11<<2)|0);
   $241 = HEAP32[$240>>2]|0;
   $242 = HEAP32[(8304)>>2]|0;
   $243 = ($241>>>0)<($242>>>0);
   if ($243) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $240;$F16$0 = $241;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$0;
  $244 = ((($F16$0)) + 12|0);
  HEAP32[$244>>2] = $p$0;
  $245 = ((($p$0)) + 8|0);
  HEAP32[$245>>2] = $F16$0;
  $246 = ((($p$0)) + 12|0);
  HEAP32[$246>>2] = $234;
  return;
 }
 $247 = $psize$1 >>> 8;
 $248 = ($247|0)==(0);
 if ($248) {
  $I18$0 = 0;
 } else {
  $249 = ($psize$1>>>0)>(16777215);
  if ($249) {
   $I18$0 = 31;
  } else {
   $250 = (($247) + 1048320)|0;
   $251 = $250 >>> 16;
   $252 = $251 & 8;
   $253 = $247 << $252;
   $254 = (($253) + 520192)|0;
   $255 = $254 >>> 16;
   $256 = $255 & 4;
   $257 = $256 | $252;
   $258 = $253 << $256;
   $259 = (($258) + 245760)|0;
   $260 = $259 >>> 16;
   $261 = $260 & 2;
   $262 = $257 | $261;
   $263 = (14 - ($262))|0;
   $264 = $258 << $261;
   $265 = $264 >>> 15;
   $266 = (($263) + ($265))|0;
   $267 = $266 << 1;
   $268 = (($266) + 7)|0;
   $269 = $psize$1 >>> $268;
   $270 = $269 & 1;
   $271 = $270 | $267;
   $I18$0 = $271;
  }
 }
 $272 = (8592 + ($I18$0<<2)|0);
 $273 = ((($p$0)) + 28|0);
 HEAP32[$273>>2] = $I18$0;
 $274 = ((($p$0)) + 16|0);
 $275 = ((($p$0)) + 20|0);
 HEAP32[$275>>2] = 0;
 HEAP32[$274>>2] = 0;
 $276 = HEAP32[(8292)>>2]|0;
 $277 = 1 << $I18$0;
 $278 = $276 & $277;
 $279 = ($278|0)==(0);
 L199: do {
  if ($279) {
   $280 = $276 | $277;
   HEAP32[(8292)>>2] = $280;
   HEAP32[$272>>2] = $p$0;
   $281 = ((($p$0)) + 24|0);
   HEAP32[$281>>2] = $272;
   $282 = ((($p$0)) + 12|0);
   HEAP32[$282>>2] = $p$0;
   $283 = ((($p$0)) + 8|0);
   HEAP32[$283>>2] = $p$0;
  } else {
   $284 = HEAP32[$272>>2]|0;
   $285 = ((($284)) + 4|0);
   $286 = HEAP32[$285>>2]|0;
   $287 = $286 & -8;
   $288 = ($287|0)==($psize$1|0);
   L202: do {
    if ($288) {
     $T$0$lcssa = $284;
    } else {
     $289 = ($I18$0|0)==(31);
     $290 = $I18$0 >>> 1;
     $291 = (25 - ($290))|0;
     $292 = $289 ? 0 : $291;
     $293 = $psize$1 << $292;
     $K19$052 = $293;$T$051 = $284;
     while(1) {
      $300 = $K19$052 >>> 31;
      $301 = (((($T$051)) + 16|0) + ($300<<2)|0);
      $296 = HEAP32[$301>>2]|0;
      $302 = ($296|0)==(0|0);
      if ($302) {
       $$lcssa = $301;$T$051$lcssa = $T$051;
       break;
      }
      $294 = $K19$052 << 1;
      $295 = ((($296)) + 4|0);
      $297 = HEAP32[$295>>2]|0;
      $298 = $297 & -8;
      $299 = ($298|0)==($psize$1|0);
      if ($299) {
       $T$0$lcssa = $296;
       break L202;
      } else {
       $K19$052 = $294;$T$051 = $296;
      }
     }
     $303 = HEAP32[(8304)>>2]|0;
     $304 = ($$lcssa>>>0)<($303>>>0);
     if ($304) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$lcssa>>2] = $p$0;
      $305 = ((($p$0)) + 24|0);
      HEAP32[$305>>2] = $T$051$lcssa;
      $306 = ((($p$0)) + 12|0);
      HEAP32[$306>>2] = $p$0;
      $307 = ((($p$0)) + 8|0);
      HEAP32[$307>>2] = $p$0;
      break L199;
     }
    }
   } while(0);
   $308 = ((($T$0$lcssa)) + 8|0);
   $309 = HEAP32[$308>>2]|0;
   $310 = HEAP32[(8304)>>2]|0;
   $311 = ($309>>>0)>=($310>>>0);
   $not$ = ($T$0$lcssa>>>0)>=($310>>>0);
   $312 = $311 & $not$;
   if ($312) {
    $313 = ((($309)) + 12|0);
    HEAP32[$313>>2] = $p$0;
    HEAP32[$308>>2] = $p$0;
    $314 = ((($p$0)) + 8|0);
    HEAP32[$314>>2] = $309;
    $315 = ((($p$0)) + 12|0);
    HEAP32[$315>>2] = $T$0$lcssa;
    $316 = ((($p$0)) + 24|0);
    HEAP32[$316>>2] = 0;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $317 = HEAP32[(8320)>>2]|0;
 $318 = (($317) + -1)|0;
 HEAP32[(8320)>>2] = $318;
 $319 = ($318|0)==(0);
 if ($319) {
  $sp$0$in$i = (8744);
 } else {
  return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $320 = ($sp$0$i|0)==(0|0);
  $321 = ((($sp$0$i)) + 8|0);
  if ($320) {
   break;
  } else {
   $sp$0$in$i = $321;
  }
 }
 HEAP32[(8320)>>2] = -1;
 return;
}
function _calloc($n_elements,$elem_size) {
 $n_elements = $n_elements|0;
 $elem_size = $elem_size|0;
 var $$ = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $req$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($n_elements|0)==(0);
 if ($0) {
  $req$0 = 0;
 } else {
  $1 = Math_imul($elem_size, $n_elements)|0;
  $2 = $elem_size | $n_elements;
  $3 = ($2>>>0)>(65535);
  if ($3) {
   $4 = (($1>>>0) / ($n_elements>>>0))&-1;
   $5 = ($4|0)==($elem_size|0);
   $$ = $5 ? $1 : -1;
   $req$0 = $$;
  } else {
   $req$0 = $1;
  }
 }
 $6 = (_malloc($req$0)|0);
 $7 = ($6|0)==(0|0);
 if ($7) {
  return ($6|0);
 }
 $8 = ((($6)) + -4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 & 3;
 $11 = ($10|0)==(0);
 if ($11) {
  return ($6|0);
 }
 _memset(($6|0),0,($req$0|0))|0;
 return ($6|0);
}
function runPostSets() {
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
  }
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
  }
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
  }

// ======== compiled code from system/lib/compiler-rt , see readme therein
function ___muldsi3($a, $b) {
  $a = $a | 0;
  $b = $b | 0;
  var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
  $1 = $a & 65535;
  $2 = $b & 65535;
  $3 = Math_imul($2, $1) | 0;
  $6 = $a >>> 16;
  $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
  $11 = $b >>> 16;
  $12 = Math_imul($11, $1) | 0;
  return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___divdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $7$0 = 0, $7$1 = 0, $8$0 = 0, $10$0 = 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0, $1$1 ^ $a$1, $1$0, $1$1) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0, $2$1 ^ $b$1, $2$0, $2$1) | 0;
  $7$0 = $2$0 ^ $1$0;
  $7$1 = $2$1 ^ $1$1;
  $8$0 = ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, 0) | 0;
  $10$0 = _i64Subtract($8$0 ^ $7$0, tempRet0 ^ $7$1, $7$0, $7$1) | 0;
  return $10$0 | 0;
}
function ___remdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $10$0 = 0, $10$1 = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 16 | 0;
  $rem = __stackBase__ | 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0, $1$1 ^ $a$1, $1$0, $1$1) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0, $2$1 ^ $b$1, $2$0, $2$1) | 0;
  ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, $rem) | 0;
  $10$0 = _i64Subtract(HEAP32[$rem >> 2] ^ $1$0, HEAP32[$rem + 4 >> 2] ^ $1$1, $1$0, $1$1) | 0;
  $10$1 = tempRet0;
  STACKTOP = __stackBase__;
  return (tempRet0 = $10$1, $10$0) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
  $x_sroa_0_0_extract_trunc = $a$0;
  $y_sroa_0_0_extract_trunc = $b$0;
  $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
  $1$1 = tempRet0;
  $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
  return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0;
  $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
  return $1$0 | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 16 | 0;
  $rem = __stackBase__ | 0;
  ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
  STACKTOP = __stackBase__;
  return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  $rem = $rem | 0;
  var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
  $n_sroa_0_0_extract_trunc = $a$0;
  $n_sroa_1_4_extract_shift$0 = $a$1;
  $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
  $d_sroa_0_0_extract_trunc = $b$0;
  $d_sroa_1_4_extract_shift$0 = $b$1;
  $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
  if (($n_sroa_1_4_extract_trunc | 0) == 0) {
    $4 = ($rem | 0) != 0;
    if (($d_sroa_1_4_extract_trunc | 0) == 0) {
      if ($4) {
        HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
        HEAP32[$rem + 4 >> 2] = 0;
      }
      $_0$1 = 0;
      $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$4) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    }
  }
  $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
  do {
    if (($d_sroa_0_0_extract_trunc | 0) == 0) {
      if ($17) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      if (($n_sroa_0_0_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0;
          HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
      if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
        }
        $_0$1 = 0;
        $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
      $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
      if ($51 >>> 0 <= 30) {
        $57 = $51 + 1 | 0;
        $58 = 31 - $51 | 0;
        $sr_1_ph = $57;
        $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
        $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
        $q_sroa_0_1_ph = 0;
        $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
        break;
      }
      if (($rem | 0) == 0) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = 0 | $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$17) {
        $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($119 >>> 0 <= 31) {
          $125 = $119 + 1 | 0;
          $126 = 31 - $119 | 0;
          $130 = $119 - 31 >> 31;
          $sr_1_ph = $125;
          $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
      if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
        $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
        $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        $89 = 64 - $88 | 0;
        $91 = 32 - $88 | 0;
        $92 = $91 >> 31;
        $95 = $88 - 32 | 0;
        $105 = $95 >> 31;
        $sr_1_ph = $88;
        $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
        $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
        $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
        $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
        break;
      }
      if (($rem | 0) != 0) {
        HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
        HEAP32[$rem + 4 >> 2] = 0;
      }
      if (($d_sroa_0_0_extract_trunc | 0) == 1) {
        $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$0 = 0 | $a$0 & -1;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
        $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
        $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
  } while (0);
  if (($sr_1_ph | 0) == 0) {
    $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
    $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
    $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
    $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = 0;
  } else {
    $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
    $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
    $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
    $137$1 = tempRet0;
    $q_sroa_1_1198 = $q_sroa_1_1_ph;
    $q_sroa_0_1199 = $q_sroa_0_1_ph;
    $r_sroa_1_1200 = $r_sroa_1_1_ph;
    $r_sroa_0_1201 = $r_sroa_0_1_ph;
    $sr_1202 = $sr_1_ph;
    $carry_0203 = 0;
    while (1) {
      $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
      $149 = $carry_0203 | $q_sroa_0_1199 << 1;
      $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
      $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
      _i64Subtract($137$0, $137$1, $r_sroa_0_0_insert_insert42$0, $r_sroa_0_0_insert_insert42$1) | 0;
      $150$1 = tempRet0;
      $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
      $152 = $151$0 & 1;
      $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0, $r_sroa_0_0_insert_insert42$1, $151$0 & $d_sroa_0_0_insert_insert99$0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1) | 0;
      $r_sroa_0_0_extract_trunc = $154$0;
      $r_sroa_1_4_extract_trunc = tempRet0;
      $155 = $sr_1202 - 1 | 0;
      if (($155 | 0) == 0) {
        break;
      } else {
        $q_sroa_1_1198 = $147;
        $q_sroa_0_1199 = $149;
        $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
        $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
        $sr_1202 = $155;
        $carry_0203 = $152;
      }
    }
    $q_sroa_1_1_lcssa = $147;
    $q_sroa_0_1_lcssa = $149;
    $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
    $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = $152;
  }
  $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
  $q_sroa_0_0_insert_ext75$1 = 0;
  $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
  if (($rem | 0) != 0) {
    HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
    HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
  }
  $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
  $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
  return (tempRet0 = $_0$1, $_0$0) | 0;
}
// =======================================================================



  
function dynCall_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return FUNCTION_TABLE_iiiiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}


function jsCall_iiiiiiii_0(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_1(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_2(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_3(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_4(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_5(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_6(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_7(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function dynCall_iiiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return FUNCTION_TABLE_iiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}


function jsCall_iiiiii_0(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_1(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_2(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_3(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_4(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_5(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_6(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_7(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function dynCall_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return FUNCTION_TABLE_iiiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}


function jsCall_iiiiiii_0(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_1(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_2(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_3(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_4(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_5(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_6(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_7(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function dynCall_iiiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return FUNCTION_TABLE_iiiii[index&31](a1|0,a2|0,a3|0,a4|0)|0;
}


function jsCall_iiiii_0(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(0,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_1(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(1,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_2(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(2,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_3(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(3,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_4(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(4,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_5(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(5,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_6(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(6,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_7(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(7,a1|0,a2|0,a3|0,a4|0)|0;
}



function dynCall_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return FUNCTION_TABLE_iiiiiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}


function jsCall_iiiiiiiii_0(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_1(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_2(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_3(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_4(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_5(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_6(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_7(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&31](a1|0,a2|0)|0;
}


function jsCall_iii_0(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(0,a1|0,a2|0)|0;
}



function jsCall_iii_1(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(1,a1|0,a2|0)|0;
}



function jsCall_iii_2(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(2,a1|0,a2|0)|0;
}



function jsCall_iii_3(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(3,a1|0,a2|0)|0;
}



function jsCall_iii_4(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(4,a1|0,a2|0)|0;
}



function jsCall_iii_5(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(5,a1|0,a2|0)|0;
}



function jsCall_iii_6(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(6,a1|0,a2|0)|0;
}



function jsCall_iii_7(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(7,a1|0,a2|0)|0;
}


function b1(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(0);return 0;
}
function b2(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(9);return 0;
}
function b3(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(10);return 0;
}
function b4(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(11);return 0;
}
function b5(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(12);return 0;
}
function b6(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(13);return 0;
}
function b7(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(14);return 0;
}
function b8(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(15);return 0;
}
function b9(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(16);return 0;
}
function b10(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(17);return 0;
}
function b11(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(19);return 0;
}
function b12(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(20);return 0;
}
function b13(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(21);return 0;
}
function b14(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(22);return 0;
}
function b15(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(23);return 0;
}
function b16(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(24);return 0;
}
function b17(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(25);return 0;
}
function b18(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(26);return 0;
}
function b19(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(27);return 0;
}
function b20(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(28);return 0;
}
function b21(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(29);return 0;
}
function b22(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(30);return 0;
}
function b23(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(31);return 0;
}
function b25(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(0);return 0;
}
function b26(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(9);return 0;
}
function b27(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(10);return 0;
}
function b28(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(11);return 0;
}
function b29(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(12);return 0;
}
function b30(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(13);return 0;
}
function b31(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(14);return 0;
}
function b32(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(15);return 0;
}
function b33(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(16);return 0;
}
function b34(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(17);return 0;
}
function b35(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(20);return 0;
}
function b36(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(21);return 0;
}
function b37(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(22);return 0;
}
function b38(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(23);return 0;
}
function b39(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(24);return 0;
}
function b40(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(25);return 0;
}
function b41(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(26);return 0;
}
function b42(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(27);return 0;
}
function b43(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(28);return 0;
}
function b44(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(29);return 0;
}
function b45(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(30);return 0;
}
function b46(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(31);return 0;
}
function b48(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(0);return 0;
}
function b49(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(9);return 0;
}
function b50(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(10);return 0;
}
function b51(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(11);return 0;
}
function b52(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(12);return 0;
}
function b53(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(13);return 0;
}
function b54(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(14);return 0;
}
function b55(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(15);return 0;
}
function b56(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(16);return 0;
}
function b57(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(17);return 0;
}
function b58(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(19);return 0;
}
function b59(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(20);return 0;
}
function b60(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(21);return 0;
}
function b61(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(22);return 0;
}
function b62(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(23);return 0;
}
function b63(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(24);return 0;
}
function b64(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(25);return 0;
}
function b65(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(26);return 0;
}
function b66(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(27);return 0;
}
function b67(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(28);return 0;
}
function b68(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(29);return 0;
}
function b69(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(30);return 0;
}
function b70(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(31);return 0;
}
function b72(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(0);return 0;
}
function b73(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(9);return 0;
}
function b74(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(10);return 0;
}
function b75(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(11);return 0;
}
function b76(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(12);return 0;
}
function b77(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(13);return 0;
}
function b78(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(14);return 0;
}
function b79(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(15);return 0;
}
function b80(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(16);return 0;
}
function b81(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(17);return 0;
}
function b82(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(19);return 0;
}
function b83(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(20);return 0;
}
function b84(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(21);return 0;
}
function b85(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(22);return 0;
}
function b86(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(23);return 0;
}
function b87(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(24);return 0;
}
function b88(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(25);return 0;
}
function b89(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(26);return 0;
}
function b90(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(27);return 0;
}
function b91(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(28);return 0;
}
function b92(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(29);return 0;
}
function b93(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(30);return 0;
}
function b94(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(31);return 0;
}
function b96(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(0);return 0;
}
function b97(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(9);return 0;
}
function b98(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(10);return 0;
}
function b99(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(11);return 0;
}
function b100(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(12);return 0;
}
function b101(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(13);return 0;
}
function b102(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(14);return 0;
}
function b103(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(15);return 0;
}
function b104(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(16);return 0;
}
function b105(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(17);return 0;
}
function b106(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(19);return 0;
}
function b107(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(20);return 0;
}
function b108(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(21);return 0;
}
function b109(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(22);return 0;
}
function b110(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(23);return 0;
}
function b111(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(24);return 0;
}
function b112(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(25);return 0;
}
function b113(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(26);return 0;
}
function b114(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(27);return 0;
}
function b115(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(28);return 0;
}
function b116(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(29);return 0;
}
function b117(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(30);return 0;
}
function b118(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(31);return 0;
}
function b120(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(0);return 0;
}
function b121(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(9);return 0;
}
function b122(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(10);return 0;
}
function b123(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(11);return 0;
}
function b124(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(12);return 0;
}
function b125(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(13);return 0;
}
function b126(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(14);return 0;
}
function b127(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(15);return 0;
}
function b128(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(16);return 0;
}
function b129(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(17);return 0;
}
function b130(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(19);return 0;
}
function b131(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(20);return 0;
}
function b132(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(21);return 0;
}
function b133(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(22);return 0;
}
function b134(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(23);return 0;
}
function b135(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(24);return 0;
}
function b136(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(25);return 0;
}
function b137(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(26);return 0;
}
function b138(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(27);return 0;
}
function b139(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(28);return 0;
}
function b140(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(29);return 0;
}
function b141(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(30);return 0;
}
function b142(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(31);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiiiiiii = [b1,jsCall_iiiiiiii_0,jsCall_iiiiiiii_1,jsCall_iiiiiiii_2,jsCall_iiiiiiii_3,jsCall_iiiiiiii_4,jsCall_iiiiiiii_5,jsCall_iiiiiiii_6,jsCall_iiiiiiii_7,b2,b3,b4,b5,b6,b7,b8,b9,b10,_stream_ietf_ref_xor_ic,b11,b12,b13,b14,b15,b16,b17,b18,b19,b20
,b21,b22,b23];
var FUNCTION_TABLE_iiiiii = [b25,jsCall_iiiiii_0,jsCall_iiiiii_1,jsCall_iiiiii_2,jsCall_iiiiii_3,jsCall_iiiiii_4,jsCall_iiiiii_5,jsCall_iiiiii_6,jsCall_iiiiii_7,b26,b27,b28,b29,b30,b31,b32,b33,b34,_stream_ref,_stream_ietf_ref,b35,b36,b37,b38,b39,b40,b41,b42,b43
,b44,b45,b46];
var FUNCTION_TABLE_iiiiiii = [b48,jsCall_iiiiiii_0,jsCall_iiiiiii_1,jsCall_iiiiiii_2,jsCall_iiiiiii_3,jsCall_iiiiiii_4,jsCall_iiiiiii_5,jsCall_iiiiiii_6,jsCall_iiiiiii_7,b49,b50,b51,b52,b53,b54,b55,b56,b57,_rlwejs_streamoutput,b58,b59,b60,b61,b62,b63,b64,b65,b66,b67
,b68,b69,b70];
var FUNCTION_TABLE_iiiii = [b72,jsCall_iiiii_0,jsCall_iiiii_1,jsCall_iiiii_2,jsCall_iiiii_3,jsCall_iiiii_4,jsCall_iiiii_5,jsCall_iiiii_6,jsCall_iiiii_7,b73,b74,b75,b76,b77,b78,b79,b80,b81,_rlwejs_extendableoutput,b82,b83,b84,b85,b86,b87,b88,b89,b90,b91
,b92,b93,b94];
var FUNCTION_TABLE_iiiiiiiii = [b96,jsCall_iiiiiiiii_0,jsCall_iiiiiiiii_1,jsCall_iiiiiiiii_2,jsCall_iiiiiiiii_3,jsCall_iiiiiiiii_4,jsCall_iiiiiiiii_5,jsCall_iiiiiiiii_6,jsCall_iiiiiiiii_7,b97,b98,b99,b100,b101,b102,b103,b104,b105,_stream_ref_xor_ic,b106,b107,b108,b109,b110,b111,b112,b113,b114,b115
,b116,b117,b118];
var FUNCTION_TABLE_iii = [b120,jsCall_iii_0,jsCall_iii_1,jsCall_iii_2,jsCall_iii_3,jsCall_iii_4,jsCall_iii_5,jsCall_iii_6,jsCall_iii_7,b121,b122,b123,b124,b125,b126,b127,b128,b129,_rlwejs_randombytes,b130,b131,b132,b133,b134,b135,b136,b137,b138,b139
,b140,b141,b142];

  return { _memset: _memset, _rlwejs_secret_alice: _rlwejs_secret_alice, _free: _free, _rlwejs_private_key_bytes: _rlwejs_private_key_bytes, _i64Add: _i64Add, _bitshift64Ashr: _bitshift64Ashr, _i64Subtract: _i64Subtract, _rlwejs_secret_bytes: _rlwejs_secret_bytes, _malloc: _malloc, _rlwejs_keypair_alice: _rlwejs_keypair_alice, _memcpy: _memcpy, _rlwejs_init: _rlwejs_init, _rlwejs_public_key_bytes: _rlwejs_public_key_bytes, _rlwejs_secret_bob: _rlwejs_secret_bob, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiiiiiii: dynCall_iiiiiiii, dynCall_iiiiii: dynCall_iiiiii, dynCall_iiiiiii: dynCall_iiiiiii, dynCall_iiiii: dynCall_iiiii, dynCall_iiiiiiiii: dynCall_iiiiiiiii, dynCall_iii: dynCall_iii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var real__rlwejs_secret_alice = asm["_rlwejs_secret_alice"]; asm["_rlwejs_secret_alice"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_alice.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real__rlwejs_private_key_bytes = asm["_rlwejs_private_key_bytes"]; asm["_rlwejs_private_key_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_private_key_bytes.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real__bitshift64Ashr = asm["_bitshift64Ashr"]; asm["_bitshift64Ashr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Ashr.apply(null, arguments);
};

var real__rlwejs_secret_bytes = asm["_rlwejs_secret_bytes"]; asm["_rlwejs_secret_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_bytes.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};

var real__rlwejs_public_key_bytes = asm["_rlwejs_public_key_bytes"]; asm["_rlwejs_public_key_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_public_key_bytes.apply(null, arguments);
};

var real__rlwejs_init = asm["_rlwejs_init"]; asm["_rlwejs_init"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_init.apply(null, arguments);
};

var real__rlwejs_keypair_alice = asm["_rlwejs_keypair_alice"]; asm["_rlwejs_keypair_alice"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_keypair_alice.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real__rlwejs_secret_bob = asm["_rlwejs_secret_bob"]; asm["_rlwejs_secret_bob"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_bob.apply(null, arguments);
};
var _rlwejs_secret_alice = Module["_rlwejs_secret_alice"] = asm["_rlwejs_secret_alice"];
var _free = Module["_free"] = asm["_free"];
var _rlwejs_private_key_bytes = Module["_rlwejs_private_key_bytes"] = asm["_rlwejs_private_key_bytes"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _memset = Module["_memset"] = asm["_memset"];
var _rlwejs_secret_bytes = Module["_rlwejs_secret_bytes"] = asm["_rlwejs_secret_bytes"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _rlwejs_public_key_bytes = Module["_rlwejs_public_key_bytes"] = asm["_rlwejs_public_key_bytes"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _rlwejs_init = Module["_rlwejs_init"] = asm["_rlwejs_init"];
var _rlwejs_keypair_alice = Module["_rlwejs_keypair_alice"] = asm["_rlwejs_keypair_alice"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _rlwejs_secret_bob = Module["_rlwejs_secret_bob"] = asm["_rlwejs_secret_bob"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = asm["dynCall_iiiiiiiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===


function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    // Work around a node.js bug where stdout buffer is not flushed at process exit:
    // Instead of process.exit() directly, wait for stdout flush event.
    // See https://github.com/joyent/node/issues/1669 and https://github.com/kripken/emscripten/issues/2582
    // Workaround is based on https://github.com/RReverser/acorn/commit/50ab143cecc9ed71a2d66f78b4aec3bb2e9844f6
    process['stdout']['once']('drain', function () {
      process['exit'](status);
    });
    console.log(' '); // Make sure to print something to force the drain event to occur, in case the stdout buffer was empty.
    // Work around another node bug where sometimes 'drain' is never fired - make another effort
    // to emit the exit status, after a significant delay (if node hasn't fired drain by then, give up)
    setTimeout(function() {
      process['exit'](status);
    }, 500);
  } else
  if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}


// EMSCRIPTEN_GENERATED_FUNCTIONS: ["_bitshift64Ashr","_i64Subtract","_i64Add","_memset","_memcpy","_bitshift64Shl","_bitshift64Lshr","_llvm_cttz_i32"]


;

function dataReturn (returnValue, result) {
	if (returnValue === 0) {
		return result;
	}
	else {
		throw new Error('R-LWE error: ' + returnValue);
	}
}

function dataResult (buffer, bytes) {
	return new Uint8Array(
		new Uint8Array(Module.HEAPU8.buffer, buffer, bytes)
	);
}

function dataFree (buffer) {
	try {
		Module._free(buffer);
	}
	catch (_) {}
}


Module._rlwejs_init();


var rlwe	= {
	publicKeyLength: Module._rlwejs_public_key_bytes(),
	privateKeyLength: Module._rlwejs_private_key_bytes(),
	secretLength: Module._rlwejs_secret_bytes(),

	aliceKeyPair: function () {
		var publicKeyBuffer		= Module._malloc(rlwe.publicKeyLength);
		var privateKeyBuffer	= Module._malloc(rlwe.privateKeyLength);

		try {
			var returnValue	= Module._rlwejs_keypair_alice(
				publicKeyBuffer,
				privateKeyBuffer
			);

			return dataReturn(returnValue, {
				publicKey: dataResult(publicKeyBuffer, rlwe.publicKeyLength),
				privateKey: dataResult(privateKeyBuffer, rlwe.privateKeyLength)
			});
		}
		finally {
			dataFree(publicKeyBuffer);
			dataFree(privateKeyBuffer);
		}
	},

	aliceSecret: function (publicKey, privateKey) {
		var publicKeyBuffer		= Module._malloc(rlwe.publicKeyLength);
		var privateKeyBuffer	= Module._malloc(rlwe.privateKeyLength);
		var secretBuffer		= Module._malloc(rlwe.secretLength);

		Module.writeArrayToMemory(publicKey, publicKeyBuffer);
		Module.writeArrayToMemory(privateKey, privateKeyBuffer);

		try {
			var returnValue	= Module._rlwejs_secret_alice(
				publicKeyBuffer,
				privateKeyBuffer,
				secretBuffer
			);

			return dataReturn(
				returnValue,
				dataResult(secretBuffer, rlwe.secretLength)
			);
		}
		finally {
			dataFree(publicKeyBuffer);
			dataFree(privateKeyBuffer);
			dataFree(secretBuffer);
		}
	},

	bobSecret: function (alicePublicKey) {
		var alicePublicKeyBuffer	= Module._malloc(rlwe.publicKeyLength);
		var bobPublicKeyBuffer		= Module._malloc(rlwe.publicKeyLength);
		var secretBuffer			= Module._malloc(rlwe.secretLength);

		Module.writeArrayToMemory(
			alicePublicKey,
			alicePublicKeyBuffer
		);

		try {
			var returnValue	= Module._rlwejs_secret_bob(
				alicePublicKeyBuffer,
				bobPublicKeyBuffer,
				secretBuffer
			);

			return dataReturn(returnValue, {
				publicKey: dataResult(bobPublicKeyBuffer, rlwe.publicKeyLength),
				secret: dataResult(secretBuffer, rlwe.secretLength)
			});
		}
		finally {
			dataFree(alicePublicKeyBuffer);
			dataFree(bobPublicKeyBuffer);
			dataFree(secretBuffer);
		}
	}
};



return rlwe;

}());

self.rlwe	= rlwe;
//# sourceMappingURL=rlwe.debug.js.map