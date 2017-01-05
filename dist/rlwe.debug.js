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
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
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
    Module['read'] = function read() { throw 'no read() available' };
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

  Module['readAsync'] = function readAsync(url, onload, onerror) {
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
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
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
  abort('NO_DYNAMIC_EXECUTION=1 was set, cannot eval');
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
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

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
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
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
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { assert(DYNAMICTOP_PTR);var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
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

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

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
    abort('NO_DYNAMIC_EXECUTION=1 was set, cannot eval');
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
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
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
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
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
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
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

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
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

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


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
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
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


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
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
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
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


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var s = func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
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
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
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
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - asm.stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 32768;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 65536;

var WASM_PAGE_SIZE = 64 * 1024;

var totalMemory = WASM_PAGE_SIZE;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024;
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



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

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
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
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

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var lastChar, end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);    
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

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

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
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

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



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;


// === Body ===

var ASM_CONSTS = [function() { { return Module.getRandomValue(); } },
 function() { { if (Module.getRandomValue === undefined) { try { var window_ = "object" === typeof window ? window : self, crypto_ = typeof window_.crypto !== "undefined" ? window_.crypto : window_.msCrypto, randomValuesStandard = function() { var buf = new Uint32Array(1); crypto_.getRandomValues(buf); return buf[0] >>> 0; }; randomValuesStandard(); Module.getRandomValue = randomValuesStandard; } catch (e) { try { var crypto = require('crypto'), randomValueNodeJS = function() { var buf = crypto.randomBytes(4); return (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0; }; randomValueNodeJS(); Module.getRandomValue = randomValueNodeJS; } catch (e) { throw 'No secure random number generator found'; } } } } }];

function _emscripten_asm_const_i(code) {
 return ASM_CONSTS[code]();
}

function _emscripten_asm_const_v(code) {
 return ASM_CONSTS[code]();
}



STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 9536;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([12,0,0,0,18,0,0,0,19,0,0,0,18,0,0,0,18,0,0,0,25,10,0,0,201,42,0,0,1,32,0,0,237,1,0,0,189,26,0,0,180,38,0,0,98,5,0,0,137,40,0,0,16,31,0,0,179,1,0,0,162,39,0,0,41,4,0,0,148,1,0,0,220,29,0,0,183,4,0,0,176,12,0,0,113,43,0,0,157,20,0,0,133,9,0,0,62,14,0,0,171,11,0,0,134,23,0,0,139,38,0,0,106,24,0,0,118,39,0,0,251,37,0,0,234,3,0,0,110,28,0,0,188,16,0,0,33,28,0,0,107,3,0,0,196,14,0,0,71,6,0,0,112,19,0,0,210,31,0,0,106,18,0,0,242,0,0,0,1,6,0,0,120,14,0,0,139,37,0,0,155,19,0,0,33,2,0,0,220,19,0,0,161,41,0,0,21,19,0,0,8,44,0,0,250,11,0,0,230,47,0,0,179,14,0,0,97,42,0,0,96,11,0,0,66,22,0,0,159,46,0,0,253,18,0,0,109,28,0,0,80,38,0,0,236,43,0,0,43,11,0,0,20,28,0,0,43,4,0,0,97,9,0,0,71,46,0,0,134,1,0,0,252,44,0,0,63,33,0,0,249,14,0,0,220,10,0,0,182,27,0,0,31,19,0,0,204,5,0,0,1,9,0,0,178,19,0,0,44,32,0,0,85,10,0,0,195,30,0,0,226,36,0,0,126,8,0,0,237,30,0,0,153,6,0,0,36,13,0,0,217,15,0,0,199,12,0,0,111,42,0,0,46,18,0,0,241,6,0,0,130,41,0,0,52,14,0,0,183,28,0,0,113,37,0,0,86,27,0,0,160,0,0,0,77,12,0,0,85,17,0,0,254,47,0,0,139,39,0,0,75,15,0,0,202,28,0,0,144,47,0,0,208,15,0,0,201,8,0,0,68,11,0,0,129,4,0,0,143,35,0,0,226,26,0,0,78,8,0,0,163,41,0,0,182,13,0,0,212,20,0,0,49,11,0,0,191,38,0,0,104,36,0,0,119,32,0,0,131,37,0,0,82,35,0,0,200,11,0,0,14,47,0,0,73,36,0,0,98,45,0,0,186,27,0,0,64,12,0,0,162,38,0,0,72,13,0,0,130,8,0,0,8,6,0,0,183,21,0,0,164,1,0,0,112,32,0,0,41,19,0,0,220,1,0,0,203,13,0,0,110,36,0,0,32,19,0,0,195,38,0,0,235,11,0,0,19,12,0,0,81,0,0,0,232,3,0,0,224,16,0,0,153,4,0,0,98,31,0,0,49,37,0,0,158,41,0,0,43,45,0,0,254,29,0,0,196,40,0,0,117,47,0,0,198,11,0,0,128,35,0,0,222,19,0,0,46,5,0,0,111,43,0,0,15,9,0,0,70,44,0,0,22,3,0,0,187,10,0,0,19,29,0,0,63,12,0,0,128,14,0,0,38,4,0,0,11,39,0,0,60,29,0,0,32,34,0,0,67,36,0,0,184,10,0,0,206,45,0,0,159,11,0,0,192,37,0,0,181,3,0,0,44,29,0,0,178,37,0,0,98,28,0,0,196,22,0,0,161,25,0,0,18,30,0,0,0,13,0,0,112,25,0,0,71,5,0,0,143,28,0,0,219,31,0,0,104,22,0,0,210,2,0,0,232,42,0,0,203,15,0,0,231,27,0,0,58,42,0,0,1,0,0,0,220,33,0,0,241,9,0,0,176,13,0,0,43,34,0,0,69,43,0,0,110,6,0,0,134,35,0,0,228,22,0,0,223,6,0,0,134,33,0,0,110,14,0,0,198,27,0,0,203,34,0,0,158,46,0,0,122,31,0,0,13,38,0,0,86,37,0,0,92,15,0,0,23,23,0,0,26,19,0,0,53,14,0,0,126,34,0,0,166,21,0,0,112,47,0,0,123,22,0,0,233,29,0,0,221,30,0,0,21,43,0,0,179,46,0,0,135,38,0,0,109,42,0,0,160,6,0,0,212,12,0,0,65,11,0,0,29,28,0,0,41,8,0,0,40,35,0,0,221,7,0,0,217,2,0,0,88,35,0,0,33,46,0,0,26,11,0,0,3,44,0,0,9,0,0,0,98,25,0,0,32,2,0,0,164,9,0,0,83,1,0,0,101,5,0,0,221,9,0,0,176,31,0,0,0,14,0,0,46,27,0,0,125,19,0,0,120,41,0,0,75,31,0,0,254,20,0,0,236,36,0,0,127,47,0,0,2,17,0,0,165,38,0,0,157,30,0,0,224,12,0,0,148,32,0,0,54,28,0,0,149,8,0,0,118,0,0,0,172,9,0,0,135,22,0,0,59,3,0,0,93,33,0,0,72,44,0,0,106,13,0,0,201,13,0,0,92,11,0,0,39,47,0,0,57,9,0,0,51,7,0,0,214,11,0,0,238,31,0,0,3,24,0,0,114,38,0,0,134,32,0,0,64,2,0,0,95,40,0,0,254,39,0,0,244,40,0,0,191,36,0,0,60,46,0,0,20,23,0,0,162,1,0,0,188,14,0,0,91,29,0,0,53,21,0,0,128,29,0,0,244,42,0,0,101,47,0,0,207,10,0,0,129,15,0,0,106,32,0,0,13,25,0,0,24,39,0,0,239,7,0,0,213,20,0,0,48,42,0,0,61,38,0,0,210,41,0,0,54,23,0,0,239,4,0,0,49,0,0,0,27,23,0,0,54,42,0,0,163,46,0,0,25,42,0,0,23,7,0,0,7,21,0,0,130,12,0,0,141,17,0,0,8,27,0,0,248,39,0,0,183,7,0,0,84,33,0,0,109,11,0,0,91,1,0,0,146,18,0,0,66,7,0,0,87,46,0,0,14,35,0,0,79,37,0,0,236,22,0,0,162,37,0,0,103,22,0,0,46,45,0,0,83,47,0,0,100,41,0,0,193,11,0,0,46,24,0,0,218,46,0,0,123,25,0,0,140,2,0,0,178,14,0,0,154,36,0,0,176,15,0,0,237,15,0,0,113,33,0,0,209,15,0,0,102,23,0,0,122,43,0,0,135,43,0,0,180,3,0,0,69,1,0,0,124,5,0,0,80,27,0,0,231,23,0,0,141,32,0,0,177,42,0,0,176,4,0,0,64,20,0,0,251,9,0,0,234,23,0,0,58,6,0,0,87,40,0,0,15,28,0,0,73,23,0,0,132,10,0,0,89,47,0,0,202,16,0,0,1,13,0,0,31,23,0,0,81,17,0,0,7,33,0,0,120,27,0,0,211,6,0,0,51,12,0,0,238,11,0,0,147,26,0,0,150,22,0,0,227,41,0,0,125,36,0,0,199,9,0,0,171,2,0,0,155,9,0,0,72,14,0,0,64,0,0,0,144,16,0,0,242,13,0,0,67,3,0,0,177,23,0,0,206,15,0,0,60,45,0,0,218,42,0,0,78,12,0,0,91,40,0,0,226,16,0,0,30,8,0,0,88,4,0,0,239,15,0,0,223,43,0,0,185,1,0,0,154,3,0,0,26,4,0,0,184,17,0,0,188,26,0,0,237,32,0,0,123,10,0,0,91,43,0,0,234,14,0,0,27,24,0,0,52,33,0,0,110,47,0,0,177,26,0,0,97,17,0,0,141,18,0,0,96,26,0,0,76,29,0,0,142,30,0,0,22,32,0,0,62,27,0,0,29,31,0,0,205,28,0,0,121,8,0,0,10,2,0,0,215,19,0,0,190,12,0,0,76,40,0,0,59,26,0,0,254,4,0,0,217,38,0,0,186,13,0,0,240,43,0,0,7,44,0,0,37,23,0,0,212,1,0,0,148,15,0,0,126,1,0,0,197,46,0,0,219,20,0,0,187,26,0,0,52,24,0,0,131,33,0,0,241,7,0,0,99,32,0,0,130,7,0,0,39,15,0,0,27,43,0,0,205,3,0,0,198,26,0,0,178,42,0,0,86,20,0,0,104,26,0,0,127,12,0,0,56,0,0,0,237,13,0,0,142,2,0,0,166,6,0,0,62,40,0,0,230,22,0,0,9,24,0,0,39,21,0,0,198,33,0,0,113,46,0,0,65,41,0,0,173,28,0,0,8,24,0,0,64,28,0,0,90,18,0,0,140,34,0,0,172,18,0,0,0,40,0,0,48,19,0,0,41,5,0,0,65,47,0,0,136,27,0,0,104,11,0,0,55,12,0,0,73,16,0,0,238,44,0,0,154,13,0,0,15,44,0,0,92,21,0,0,242,22,0,0,92,45,0,0,167,23,0,0,249,34,0,0,52,0,0,0,102,12,0,0,214,42,0,0,51,37,0,0,151,0,0,0,79,8,0,0,117,15,0,0,23,11,0,0,56,38,0,0,239,24,0,0,43,6,0,0,175,1,0,0,83,29,0,0,254,22,0,0,213,11,0,0,39,26,0,0,117,16,0,0,248,1,0,0,164,45,0,0,254,8,0,0,241,33,0,0,66,35,0,0,16,18,0,0,68,24,0,0,92,46,0,0,240,15,0,0,77,24,0,0,239,33,0,0,235,3,0,0,53,34,0,0,241,0,0,0,58,0,0,0,145,19,0,0,93,40,0,0,117,3,0,0,137,24,0,0,110,13,0,0,229,36,0,0,50,44,0,0,141,31,0,0,208,25,0,0,149,13,0,0,142,0,0,0,81,4,0,0,137,34,0,0,87,1,0,0,186,17,0,0,116,7,0,0,184,4,0,0,119,18,0,0,166,27,0,0,183,40,0,0,141,39,0,0,217,26,0,0,53,45,0,0,195,39,0,0,160,1,0,0,46,3,0,0,169,6,0,0,146,9,0,0,252,33,0,0,205,2,0,0,91,36,0,0,93,5,0,0,250,31,0,0,125,9,0,0,72,41,0,0,1,42,0,0,60,28,0,0,63,43,0,0,182,1,0,0,70,34,0,0,105,23,0,0,206,12,0,0,113,16,0,0,221,26,0,0,121,13,0,0,112,4,0,0,124,14,0,0,166,12,0,0,110,11,0,0,34,7,0,0,137,17,0,0,99,12,0,0,88,31,0,0,163,33,0,0,136,7,0,0,208,1,0,0,133,12,0,0,226,34,0,0,168,27,0,0,68,4,0,0,148,42,0,0,237,39,0,0,167,46,0,0,52,17,0,0,166,35,0,0,192,15,0,0,25,29,0,0,239,23,0,0,131,31,0,0,11,42,0,0,125,0,0,0,28,2,0,0,217,34,0,0,126,31,0,0,100,2,0,0,115,31,0,0,197,47,0,0,100,37,0,0,129,35,0,0,2,42,0,0,45,39,0,0,68,0,0,0,53,25,0,0,43,30,0,0,173,18,0,0,60,19,0,0,246,3,0,0,192,1,0,0,102,15,0,0,112,20,0,0,47,5,0,0,234,33,0,0,160,14,0,0,158,28,0,0,240,11,0,0,33,38,0,0,213,22,0,0,212,21,0,0,156,1,0,0,19,28,0,0,135,15,0,0,19,19,0,0,15,12,0,0,54,25,0,0,209,8,0,0,104,30,0,0,44,22,0,0,137,5,0,0,208,32,0,0,190,45,0,0,220,21,0,0,99,23,0,0,215,35,0,0,209,10,0,0,78,23,0,0,212,0,0,0,155,25,0,0,105,43,0,0,132,21,0,0,6,43,0,0,101,4,0,0,252,18,0,0,92,42,0,0,107,4,0,0,171,16,0,0,236,25,0,0,227,8,0,0,100,38,0,0,199,19,0,0,80,16,0,0,181,14,0,0,238,5,0,0,90,34,0,0,212,17,0,0,240,39,0,0,194,22,0,0,206,13,0,0,121,15,0,0,49,16,0,0,37,41,0,0,250,1,0,0,26,43,0,0,105,25,0,0,145,42,0,0,114,10,0,0,93,39,0,0,10,13,0,0,53,35,0,0,183,13,0,0,155,26,0,0,103,43,0,0,216,10,0,0,141,4,0,0,15,10,0,0,177,34,0,0,107,40,0,0,121,1,0,0,226,17,0,0,138,46,0,0,173,41,0,0,120,39,0,0,136,1,0,0,213,40,0,0,169,1,0,0,17,37,0,0,193,0,0,0,183,8,0,0,53,24,0,0,14,4,0,0,102,44,0,0,60,24,0,0,186,31,0,0,78,11,0,0,70,14,0,0,223,42,0,0,49,41,0,0,199,25,0,0,151,9,0,0,175,46,0,0,107,15,0,0,20,0,0,0,138,19,0,0,43,20,0,0,0,18,0,0,242,34,0,0,234,31,0,0,154,39,0,0,242,5,0,0,217,33,0,0,157,40,0,0,16,13,0,0,222,21,0,0,212,42,0,0,165,25,0,0,252,43,0,0,153,7,0,0,33,43,0,0,119,38,0,0,6,28,0,0,75,19,0,0,100,8,0,0,186,24,0,0,119,15,0,0,165,22,0,0,49,19,0,0,200,13,0,0,118,31,0,0,241,14,0,0,210,34,0,0,14,39,0,0,239,16,0,0,192,34,0,0,126,36,0,0,142,15,0,0,24,26,0,0,133,45,0,0,110,30,0,0,217,25,0,0,201,6,0,0,110,2,0,0,245,40,0,0,134,42,0,0,51,24,0,0,188,27,0,0,151,6,0,0,150,1,0,0,111,47,0,0,148,20,0,0,173,36,0,0,18,47,0,0,226,3,0,0,55,30,0,0,88,21,0,0,215,28,0,0,62,18,0,0,0,2,0,0,108,1,0,0,201,38,0,0,212,11,0,0,96,20,0,0,142,21,0,0,202,4,0,0,126,29,0,0,102,31,0,0,131,27,0,0,134,30,0,0,45,43,0,0,201,11,0,0,49,12,0,0,160,29,0,0,40,10,0,0,224,43,0,0,124,26,0,0,53,47,0,0,99,20,0,0,129,5,0,0,128,37,0,0,253,17,0,0,215,31,0,0,77,47,0,0,207,1,0,0,178,34,0,0,116,32,0,0,69,42,0,0,31,36,0,0,193,42,0,0,78,38,0,0,6,8,0,0,59,24,0,0,243,25,0,0,48,12,0,0,217,23,0,0,156,32,0,0,88,33,0,0,7,27,0,0,49,34,0,0,255,42,0,0,13,34,0,0,241,36,0,0,229,7,0,0,100,35,0,0,122,18,0,0,89,15,0,0,87,41,0,0,139,14,0,0,77,3,0,0,144,7,0,0,7,0,0,0,190,19,0,0,82,12,0,0,213,12,0,0,8,17,0,0,221,14,0,0,2,45,0,0,165,8,0,0,57,16,0,0,207,47,0,0,41,47,0,0,150,21,0,0,1,3,0,0,3,16,0,0,104,15,0,0,228,21,0,0,154,21,0,0,16,43,0,0,66,36,0,0,123,8,0,0,152,13,0,0,10,29,0,0,72,33,0,0,160,12,0,0,220,46,0,0,184,37,0,0,126,5,0,0,129,11,0,0,229,20,0,0,39,28,0,0,238,17,0,0,87,45,0,0,45,44,0,0,82,20,0,0,76,3,0,0,170,27,0,0,210,15,0,0,80,31,0,0,108,35,0,0,222,37,0,0,4,33,0,0,88,27,0,0,30,22,0,0,55,2,0,0,125,11,0,0,171,33,0,0,224,14,0,0,123,19,0,0,69,9,0,0,15,20,0,0,63,0,0,0,181,29,0,0,32,13,0,0,63,46,0,0,105,40,0,0,66,2,0,0,9,27,0,0,204,29,0,0,254,1,0,0,10,21,0,0,62,10,0,0,126,30,0,0,71,22,0,0,31,42,0,0,8,36,0,0,115,44,0,0,12,23,0,0,111,18,0,0,18,45,0,0,174,13,0,0,157,22,0,0,135,41,0,0,242,21,0,0,58,3,0,0,179,19,0,0,18,12,0,0,139,42,0,0,223,38,0,0,172,29,0,0,245,8,0,0,96,46,0,0,7,24,0,0,141,13,0,0,91,17,0,0,167,34,0,0,19,6,0,0,10,7,0,0,239,19,0,0,99,7,0,0,199,4,0,0,30,9,0,0,198,30,0,0,54,6,0,0,113,3,0,0,109,1,0,0,135,7,0,0,10,44,0,0,158,17,0,0,180,37,0,0,130,11,0,0,172,26,0,0,0,5,0,0,102,2,0,0,166,42,0,0,233,47,0,0,82,28,0,0,86,26,0,0,76,38,0,0,121,44,0,0,228,8,0,0,43,44,0,0,33,10,0,0,111,3,0,0,219,30,0,0,135,31,0,0,126,13,0,0,83,33,0,0,211,14,0,0,61,35,0,0,144,22,0,0,57,7,0,0,86,30,0,0,52,31,0,0,201,1,0,0,8,0,0,0,18,2,0,0,191,37,0,0,105,30,0,0,247,44,0,0,250,13,0,0,168,29,0,0,92,41,0,0,138,13,0,0,12,35,0,0,29,38,0,0,4,13,0,0,139,0,0,0,254,7,0,0,124,11,0,0,56,42,0,0,116,36,0,0,106,3,0,0,253,8,0,0,18,22,0,0,87,47,0,0,150,0,0,0,136,2,0,0,64,31,0,0,254,38,0,0,200,36,0,0,11,11,0,0,130,9,0,0,234,44,0,0,81,25,0,0,236,47,0,0,26,38,0,0,161,43,0,0,47,46,0,0,251,43,0,0,237,14,0,0,112,41,0,0,113,11,0,0,119,24,0,0,41,18,0,0,176,24,0,0,215,37,0,0,148,40,0,0,246,1,0,0,254,19,0,0,48,33,0,0,82,24,0,0,220,41,0,0,251,32,0,0,200,29,0,0,227,26,0,0,53,36,0,0,216,25,0,0,172,33,0,0,167,20,0,0,176,3,0,0,95,29,0,0,237,23,0,0,90,7,0,0,241,43,0,0,14,40,0,0,34,21,0,0,227,4,0,0,254,6,0,0,155,20,0,0,1,33,0,0,207,40,0,0,17,16,0,0,72,0,0,0,12,11,0,0,0,17,0,0,31,29,0,0,152,10,0,0,40,43,0,0,231,30,0,0,123,13,0,0,254,15,0,0,108,25,0,0,229,11,0,0,186,43,0,0,83,10,0,0,247,6,0,0,43,28,0,0,110,19,0,0,44,30,0,0,83,38,0,0,233,36,0,0,203,11,0,0,98,16,0,0,170,10,0,0,222,26,0,0,181,40,0,0,205,8,0,0,166,17,0,0,235,35,0,0,45,29,0,0,121,43,0,0,213,35,0,0,68,47,0,0,227,6,0,0,161,8,0,0,145,37,0,0,50,20,0,0,97,3,0,0,255,4,0,0,158,6,0,0,7,42,0,0,228,32,0,0,71,17,0,0,59,41,0,0,231,14,0,0,200,22,0,0,187,42,0,0,1,32,0,0,20,46,0,0,77,9,0,0,68,21,0,0,78,46,0,0,241,16,0,0,120,7,0,0,159,42,0,0,100,27,0,0,144,4,0,0,81,35,0,0,74,43,0,0,37,18,0,0,109,46,0,0,216,43,0,0,95,8,0,0,145,28,0,0,186,41,0,0,61,33,0,0,150,44,0,0,224,19,0,0,69,31,0,0,147,19,0,0,23,44,0,0,6,10,0,0,139,8,0,0,151,23,0,0,118,9,0,0,123,24,0,0,86,36,0,0,195,33,0,0,124,38,0,0,8,33,0,0,194,14,0,0,5,3,0,0,123,46,0,0,186,1,0,0,160,38,0,0,214,43,0,0,237,19,0,0,214,36,0,0,21,4,0,0,177,9,0,0,148,19,0,0,4,29,0,0,98,1,0,0,191,25,0,0,161,36,0,0,160,5,0,0,78,33,0,0,27,0,0,0,7,36,0,0,249,3,0,0,236,28,0,0,96,6,0,0,37,28,0,0,224,45,0,0,102,28,0,0,118,10,0,0,137,33,0,0,0,42,0,0,15,47,0,0,151,29,0,0,47,16,0,0,54,34,0,0,37,46,0,0,216,28,0,0,145,15,0,0,93,46,0,0,74,26,0,0,249,41,0,0,127,39,0,0,185,34,0,0,95,9,0,0,193,35,0,0,71,20,0,0,159,2,0,0,184,11,0,0,243,0,0,0,57,36,0,0,175,12,0,0,126,10,0,0,138,15,0,0,153,11,0,0,66,9,0,0,208,36,0,0,45,27,0,0,75,34,0,0,94,6,0,0,179,39,0,0,31,21,0,0,114,12,0,0,128,43,0,0,189,36,0,0,56,39,0,0,49,32,0,0,113,0,0,0,55,19,0,0,182,32,0,0,118,8,0,0,3,0,0,0,172,30,0,0,180,35,0,0,97,47,0,0,171,20,0,0,144,10,0,0,74,19,0,0,205,33,0,0,127,6,0,0,16,41,0,0,211,29,0,0,146,5,0,0,58,35,0,0,40,32,0,0,221,34,0,0,104,41,0,0,20,17,0,0,131,39,0,0,31,11,0,0,62,17,0,0,172,37,0,0,213,15,0,0,79,28,0,0,0,39,0,0,53,42,0,0,226,28,0,0,75,20,0,0,37,37,0,0,185,3,0,0,164,14,0,0,198,44,0,0,122,25,0,0,85,38,0,0,139,47,0,0,108,39,0,0,203,19,0,0,109,15,0,0,33,35,0,0,100,17,0,0,92,9,0,0,255,30,0,0,130,0,0,0,21,11,0,0,3,27,0,0,182,16,0,0,137,6,0,0,132,28,0,0,211,20,0,0,1,34,0,0,81,16,0,0,36,38,0,0,156,42,0,0,174,46,0,0,93,38,0,0,225,45,0,0,159,22,0,0,248,47,0,0,254,3,0,0,231,36,0,0,224,1,0,0,169,12,0,0,40,45,0,0,36,40,0,0,217,12,0,0,216,39,0,0,228,19,0,0,192,36,0,0,45,35,0,0,97,41,0,0,148,5,0,0,122,9,0,0,78,1,0,0,236,4,0,0,36,17,0,0,24,18,0,0,134,25,0,0,145,0,0,0,91,26,0,0,131,13,0,0,204,33,0,0,231,28,0,0,234,24,0,0,165,32,0,0,171,10,0,0,244,9,0,0,135,16,0,0,99,1,0,0,54,13,0,0,59,20,0,0,147,33,0,0,123,14,0,0,34,41,0,0,29,25,0,0,123,12,0,0,147,41,0,0,188,4,0,0,214,13,0,0,81,34,0,0,16,38,0,0,37,14,0,0,0,48,0,0,199,5,0,0,26,20,0,0,54,32,0,0,25,5,0,0,47,45,0,0,153,25,0,0,38,16,0,0,114,19,0,0,186,42,0,0,145,22,0,0,1,35,0,0,239,17,0,0,96,22,0,0,61,25,0,0,159,19,0,0,79,10,0,0,213,18,0,0,76,44,0,0,65,10,0,0,98,36,0,0,51,2,0,0,73,37,0,0,190,11,0,0,225,13,0,0,197,18,0,0,246,8,0,0,219,43,0,0,129,33,0,0,194,35,0,0,238,18,0,0,70,37,0,0,235,44,0,0,187,3,0,0,242,38,0,0,146,4,0,0,211,42,0,0,35,28,0,0,129,12,0,0,59,36,0,0,140,0,0,0,61,7,0,0,3,18,0,0,214,2,0,0,99,6,0,0,208,10,0,0,159,16,0,0,104,43,0,0,33,31,0,0,25,44,0,0,176,47,0,0,238,35,0,0,22,36,0,0,62,9,0,0,225,28,0,0,147,11,0,0,176,43,0,0,115,47,0,0,108,34,0,0,49,22,0,0,116,16,0,0,207,3,0,0,28,11,0,0,147,34,0,0,120,23,0,0,140,44,0,0,164,7,0,0,112,28,0,0,199,47,0,0,16,47,0,0,204,13,0,0,22,44,0,0,18,14,0,0,180,23,0,0,17,32,0,0,165,1,0,0,189,23,0,0,241,29,0,0,191,12,0,0,16,14,0,0,3,39,0,0,93,2,0,0,9,46,0,0,140,31,0,0,218,21,0,0,44,36,0,0,3,25,0,0,174,18,0,0,82,46,0,0,214,41,0,0,18,23,0,0,201,9,0,0,234,36,0,0,140,32,0,0,178,39,0,0,106,47,0,0,206,10,0,0,43,5,0,0,155,35,0,0,205,47,0,0,8,13,0,0,90,24,0,0,165,2,0,0,15,25,0,0,165,26,0,0,242,3,0,0,103,34,0,0,19,3,0,0,184,31,0,0,202,35,0,0,153,36,0,0,121,20,0,0,192,0,0,0,216,42,0,0,209,28,0,0,1,8,0,0,85,29,0,0,117,13,0,0,167,29,0,0,193,19,0,0,249,23,0,0,84,19,0,0,192,6,0,0,144,1,0,0,59,14,0,0,218,26,0,0,248,23,0,0,27,25,0,0,195,7,0,0,91,41,0,0,115,45,0,0,20,34,0,0,201,47,0,0,130,35,0,0,153,21,0,0,171,27,0,0,79,5,0,0,59,21,0,0,52,44,0,0,230,4,0,0,218,32,0,0,127,40,0,0,158,15,0,0,16,40,0,0,126,14,0,0,205,23,0,0,70,21,0,0,38,27,0,0,60,1,0,0,131,46,0,0,109,32,0,0,45,46,0,0,220,24,0,0,250,3,0,0,17,4,0,0,71,34,0,0,40,9,0,0,3,43,0,0,198,21,0,0,181,7,0,0,67,35,0,0,42,28,0,0,247,45,0,0,136,39,0,0,52,19,0,0,228,16,0,0,195,20,0,0,235,15,0,0,115,17,0,0,181,18,0,0,161,21,0,0,116,29,0,0,160,30,0,0,80,21,0,0,147,0,0,0,205,14,0,0,230,23,0,0,23,33,0,0,166,4,0,0,134,37,0,0,20,15,0,0,69,21,0,0,73,30,0,0,231,43,0,0,103,44,0,0,72,46,0,0,34,4,0,0,18,32,0,0,169,43,0,0,227,39,0,0,31,31,0,0,166,7,0,0,179,35,0,0,39,5,0,0,197,2,0,0,51,32,0,0,80,24,0,0,190,44,0,0,15,34,0,0,113,31,0,0,193,47,0,0,185,33,0,0,102,38,0,0,86,45,0,0,58,38,0,0,132,11,0,0,30,6,0,0,107,25,0,0,110,21,0,0,19,36,0,0,206,35,0,0,46,41,0,0,137,20,0,0,250,14,0,0,176,30,0,0,226,24,0,0,0,35,0,0,55,31,0,0,168,0,0,0,125,37,0,0,184,24,0,0,242,19,0,0,170,7,0,0,199,41,0,0,23,24,0,0,6,38,0,0,193,27,0,0,81,43,0,0,80,5,0,0,116,15,0,0,26,24,0,0,177,20,0,0,133,42,0,0,188,46,0,0,77,44,0,0,122,4,0,0,135,4,0,0,155,24,0,0,48,32,0,0,144,14,0,0,20,32,0,0,81,32,0,0,103,11,0,0,79,33,0,0,117,45,0,0,134,22,0,0,39,1,0,0,211,23,0,0,64,36,0,0,157,6,0,0,174,0,0,0,211,2,0,0,154,25,0,0,95,10,0,0,21,25,0,0,178,10,0,0,243,12,0,0,170,1,0,0,191,40,0,0,111,29,0,0,166,46,0,0,148,36,0,0,173,14,0,0,74,40,0,0,9,8,0,0,249,20,0,0,116,30,0,0,127,35,0,0,250,26,0,0,234,40,0,0,232,5,0,0,94,1,0,0,203,5,0,0,230,24,0,0,208,47,0,0,18,43,0,0,203,24,0,0,47,6,0,0,196,9,0,0,209,5,0,0,44,27,0,0,18,40,0,0,233,8,0,0,244,22,0,0,151,15,0,0,128,32,0,0,50,37,0,0,156,0,0,0,13,5,0,0,129,18,0,0,204,26,0,0,166,18,0,0,69,33,0,0,95,46,0,0,237,24,0,0,197,1,0,0,66,11,0,0,13,7,0,0,3,8,0,0,162,7,0,0,193,45,0,0,123,15,0,0,143,9,0,0,254,23,0,0,19,16,0,0,43,36,0,0,206,40,0,0,200,38,0,0,218,0,0,0,165,36,0,0,56,34,0,0,151,34,0,0,70,5,0,0,57,25,0,0,26,33,0,0,198,6,0,0,186,30,0,0,29,15,0,0,250,5,0,0,99,41,0,0,2,43,0,0,160,44,0,0,207,27,0,0,112,10,0,0,96,39,0,0,30,41,0,0,189,0,0,0,44,12,0,0,136,4,0,0,212,18,0,0,22,12,0,0,91,30,0,0,52,39,0,0,76,7,0,0,35,21,0,0,87,37,0,0,159,31,0,0,54,36,0,0,24,11,0,0,174,9,0,0,213,17,0,0,147,28,0,0,214,19,0,0,10,41,0,0,174,37,0,0,71,4,0,0,28,36,0,0,149,22,0,0,3,32,0,0,134,34,0,0,26,17,0,0,217,4,0,0,105,37,0,0,226,18,0,0,1,31,0,0,245,36,0,0,185,47,0,0,240,31,0,0,50,7,0,0,0,15,0,0,102,27,0,0,3,41,0,0,30,43,0,0,223,26,0,0,243,7,0,0,16,4,0,0,167,40,0,0,20,24,0,0,162,18,0,0,81,44,0,0,90,27,0,0,85,14,0,0,41,22,0,0,204,11,0,0,30,21,0,0,57,18,0,0,6,15,0,0,37,6,0,0,175,23,0,0,209,14,0,0,3,28,0,0,11,46,0,0,109,7,0,0,42,10,0,0,81,23,0,0,216,29,0,0,138,23,0,0,144,36,0,0,145,6,0,0,20,33,0,0,6,4,0,0,210,1,0,0,96,4,0,0,231,9,0,0,21,0,0,0,176,22,0,0,23,3,0,0,127,38,0,0,246,36,0,0,57,11,0,0,3,9,0,0,193,16,0,0,121,45,0,0,107,47,0,0,170,0,0,0,239,25,0,0,4,39,0,0,151,44,0,0,141,11,0,0,201,5,0,0,133,36,0,0,3,40,0,0,118,47,0,0,253,34,0,0,228,9,0,0,245,12,0,0,119,34,0,0,165,6,0,0,89,18,0,0,7,34,0,0,10,3,0,0,152,17,0,0,66,10,0,0,239,45,0,0,249,47,0,0,56,46,0,0,205,16,0,0,171,17,0,0,200,40,0,0,113,25,0,0,196,12,0,0,46,33,0,0,174,14,0,0,131,34,0,0,122,16,0,0,38,17,0,0,146,44,0,0,224,37,0,0,214,3,0,0,29,39,0,0,136,3,0,0,181,9,0,0,171,21,0,0,175,19,0,0,24,0,0,0,91,5,0,0,155,45,0,0,1,43,0,0,85,21,0,0,127,36,0,0,77,10,0,0,99,30,0,0,247,3,0,0,122,40,0,0,148,46,0,0,144,44,0,0,203,41,0,0,59,17,0,0,227,38,0,0,58,43,0,0,158,40,0,0,18,28,0,0,247,40,0,0,238,41,0,0,90,13,0,0,166,30,0,0,116,34,0,0,250,23,0,0,161,1,0,0,12,39,0,0,85,18,0,0,34,9,0,0,118,5,0,0,239,35,0,0,78,28,0,0,199,44,0,0,15,26,0,0,122,6,0,0,100,25,0,0,83,34,0,0,239,2,0,0,146,29,0,0,245,24,0,0,142,3,0,0,249,11,0,0,226,5,0,0,186,25,0,0,131,17,0,0,195,37,0,0,247,26,0,0,3,46,0,0,53,18,0,0,248,20,0,0,191,45,0,0,152,7,0,0,194,1,0,0,225,34,0,0,76,18,0,0,194,47,0,0,242,27,0,0,188,38,0,0,134,28,0,0,33,33,0,0,86,14,0,0,132,36,0,0,202,45,0,0,227,25,0,0,169,20,0,0,253,14,0,0,35,10,0,0,149,12,0,0,177,16,0,0,47,32,0,0,87,20,0,0,181,44,0,0,175,27,0,0,212,3,0,0,170,2,0,0,19,30,0,0,218,19,0,0,28,27,0,0,128,36,0,0,131,42,0,0,73,10,0,0,37,1,0,0,97,35,0,0,185,14,0,0,247,18,0,0,105,34,0,0,134,39,0,0,191,11,0,0,241,4,0,0,103,26,0,0,29,26,0,0,153,32,0,0,254,31,0,0,0,45,0,0,107,26,0,0,216,0,0,0,50,0,0,0,200,31,0,0,92,39,0,0,255,2,0,0,36,33,0,0,249,30,0,0,44,35,0,0,175,35,0,0,67,28,0,0,250,47,0,0,113,40,0,0,180,44,0,0,118,33,0,0,170,6,0,0,168,32,0,0,135,29,0,0,157,12,0,0,28,40,0,0,16,11,0,0,244,13,0,0,2,5,0,0,208,13,0,0,250,20,0,0,169,14,0,0,101,15,0,0,40,24,0,0,209,35,0,0,14,22,0,0,198,23,0,0,251,39,0,0,179,9,0,0,64,5,0,0,226,11,0,0,188,5,0,0,141,15,0,0,79,13,0,0,50,46,0,0,180,0,0,0,42,16,0,0,4,30,0,0,129,10,0,0,128,42,0,0,158,27,0,0,204,0,0,0,133,21,0,0,33,4,0,0,217,37,0,0,97,18,0,0,208,35,0,0,56,36,0,0,212,4,0,0,123,17,0,0,126,20,0,0,155,16,0,0,131,18,0,0,55,43,0,0,115,26,0,0,161,27,0,0,45,36,0,0,56,9,0,0,149,46,0,0,1,46,0,0,195,29,0,0,42,19,0,0,169,26,0,0,202,17,0,0,31,44,0,0,239,0,0,0,84,11,0,0,109,27,0,0,146,0,0,0,107,46,0,0,106,41,0,0,69,20,0,0,206,23,0,0,123,5,0,0,12,7,0,0,147,45,0,0,56,41,0,0,40,22,0,0,147,17,0,0,124,2,0,0,233,21,0,0,115,32,0,0,131,11,0,0,65,13,0,0,18,31,0,0,243,8,0,0,47,13,0,0,16,33,0,0,139,16,0,0,57,34,0,0,208,28,0,0,92,25,0,0,138,32,0,0,71,23,0,0,157,39,0,0,182,28,0,0,251,19,0,0,138,9,0,0,224,4,0,0,104,40,0,0,5,4,0,0,92,22,0,0,45,5,0,0,35,26,0,0,241,34,0,0,100,7,0,0,40,14,0,0,15,42,0,0,103,8,0,0,23,16,0,0,15,13,0,0,1,30,0,0,214,27,0,0,119,28,0,0,237,47,0,0,150,32,0,0,82,1,0,0,106,38,0,0,58,22,0,0,208,6,0,0,34,5,0,0,187,33,0,0,179,36,0,0,71,16,0,0,197,23,0,0,155,3,0,0,243,43,0,0,204,23,0,0,74,39,0,0,64,47,0,0,240,10,0,0,88,46,0,0,44,7,0,0,121,46,0,0,137,8,0,0,84,6,0,0,119,1,0,0,31,30,0,0,136,46,0,0,150,7,0,0,80,13,0,0,242,37,0,0,116,43,0,0,41,37,0,0,154,4,0,0,102,21,0,0,74,34,0,0,204,12,0,0,247,34,0,0,164,8,0,0,143,37,0,0,112,5,0,0,152,22,0,0,231,4,0,0,7,46,0,0,220,6,0,0,208,31,0,0,136,32,0,0,51,34,0,0,63,25,0,0,17,8,0,0,45,30,0,0,167,13,0,0,19,42,0,0,76,33,0,0,177,31,0,0,58,28,0,0,157,9,0,0,30,39,0,0,21,22,0,0,86,31,0,0,150,43,0,0,165,5,0,0,5,29,0,0,156,43,0,0,251,4,0,0,125,26,0,0,152,4,0,0,102,22,0,0,45,47,0,0,179,24,0,0,48,37,0,0,42,12,0,0,158,24,0,0,37,26,0,0,67,2,0,0,49,15,0,0,120,42,0,0,213,25,0,0,153,17,0,0,48,39,0,0,203,22,0,0,242,35,0,0,238,28,0,0,122,32,0,0,238,19,0,0,101,46,0,0,45,26,0,0,44,25,0,0,224,9,0,0,17,36,0,0,99,19,0,0,97,33,0,0,23,14,0,0,210,42,0,0,145,27,0,0,155,32,0,0,65,46,0,0,11,44,0,0,197,28,0,0,84,29,0,0,214,17,0,0,204,22,0,0,189,47,0,0,212,8,0,0,255,5,0,0,128,12,0,0,157,10,0,0,60,0,0,0,142,16,0,0,157,45,0,0,131,16,0,0,40,13,0,0,229,45,0,0,132,47,0,0,246,5,0,0,126,16,0,0,18,24,0,0,232,18,0,0,65,32,0,0,91,12,0,0,205,30,0,0,90,1,0,0,20,8,0,0,109,5,0,0,189,43,0,0,89,20,0,0,31,13,0,0,124,35,0,0,49,46,0,0,121,40,0,0,94,14,0,0,169,16,0,0,158,35,0,0,120,30,0,0,223,40,0,0,147,36,0,0,91,35,0,0,133,33,0,0,145,43,0,0,136,34,0,0,36,21,0,0,144,31,0,0,51,35,0,0,152,24,0,0,187,13,0,0,75,46,0,0,194,4,0,0,197,19,0,0,0,6,0,0,185,6,0,0,132,38,0,0,7,16,0,0,164,42,0,0,166,11,0,0,52,45,0,0,5,14,0,0,111,38,0,0,88,41,0,0,211,44,0,0,97,46,0,0,62,8,0,0,204,2,0,0,40,21,0,0,116,8,0,0,74,7,0,0,91,20,0,0,138,29,0,0,73,43,0,0,141,40,0,0,71,30,0,0,170,46,0,0,120,13,0,0,0,8,0,0,0,4,0,0,123,32,114,101,116,117,114,110,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,40,41,59,32,125,0,123,32,105,102,32,40,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,61,61,32,117,110,100,101,102,105,110,101,100,41,32,123,32,116,114,121,32,123,32,118,97,114,32,119,105,110,100,111,119,95,32,61,32,34,111,98,106,101,99,116,34,32,61,61,61,32,116,121,112,101,111,102,32,119,105,110,100,111,119,32,63,32,119,105,110,100,111,119,32,58,32,115,101,108,102,44,32,99,114,121,112,116,111,95,32,61,32,116,121,112,101,111,102,32,119,105,110,100,111,119,95,46,99,114,121,112,116,111,32,33,61,61,32,34,117,110,100,101,102,105,110,101,100,34,32,63,32,119,105,110,100,111,119,95,46,99,114,121,112,116,111,32,58,32,119,105,110,100,111,119,95,46,109,115,67,114,121,112,116,111,44,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,32,61,32,102,117,110,99,116,105,111,110,40,41,32,123,32,118,97,114,32,98,117,102,32,61,32,110,101,119,32,85,105,110,116,51,50,65,114,114,97,121,40,49,41,59,32,99,114,121,112,116,111,95,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,115,40,98,117,102,41,59,32,114,101,116,117,114,110,32,98,117,102,91,48,93,32,62,62,62,32,48,59,32,125,59,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,40,41,59,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,59,32,125,32,99,97,116,99,104,32,40,101,41,32,123,32,116,114,121,32,123,32,118,97,114,32,99,114,121,112,116,111,32,61,32,114,101,113,117,105,114,101,40,39,99,114,121,112,116,111,39,41,44,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,32,61,32,102,117,110,99,116,105,111,110,40,41,32,123,32,118,97,114,32,98,117,102,32,61,32,99,114,121,112,116,111,46,114,97,110,100,111,109,66,121,116,101,115,40,52,41,59,32,114,101,116,117,114,110,32,40,98,117,102,91,48,93,32,60,60,32,50,52,32,124,32,98,117,102,91,49,93,32,60,60,32,49,54,32,124,32,98,117,102,91,50,93,32,60,60,32,56,32,124,32,98,117,102,91,51,93,41,32,62,62,62,32,48,59,32,125,59,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,40,41,59,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,59,32,125,32,99,97,116,99,104,32,40,101,41,32,123,32,116,104,114,111,119,32,39,78,111,32,115,101,99,117,114,101,32,114,97,110,100,111,109,32,110,117,109,98,101,114,32,103,101,110,101,114,97,116,111,114,32,102,111,117,110,100,39,59,32,125,32,125,32,125,32,125,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

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
  Module["_sbrk"] = _sbrk;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

  var _emscripten_asm_const=true;

  var _emscripten_asm_const_int=true;

  function _abort() {
      Module['abort']();
    }

   
  Module["_pthread_self"] = _pthread_self;

  
   
  Module["___muldsi3"] = ___muldsi3; 
  Module["___muldi3"] = ___muldi3;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");



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

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_iiiiiiii": nullFunc_iiiiiiii, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_iiiiiii": nullFunc_iiiiiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii, "nullFunc_iii": nullFunc_iii, "invoke_iiiiiiii": invoke_iiiiiiii, "jsCall_iiiiiiii": jsCall_iiiiiiii, "invoke_iiiiii": invoke_iiiiii, "jsCall_iiiiii": jsCall_iiiiii, "invoke_iiiiiii": invoke_iiiiiii, "jsCall_iiiiiii": jsCall_iiiiiii, "invoke_iiiii": invoke_iiiii, "jsCall_iiiii": jsCall_iiiii, "invoke_iiiiiiiii": invoke_iiiiiiiii, "jsCall_iiiiiiiii": jsCall_iiiiiiiii, "invoke_iii": invoke_iii, "jsCall_iii": jsCall_iii, "_emscripten_asm_const_v": _emscripten_asm_const_v, "___setErrNo": ___setErrNo, "_abort": _abort, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_asm_const_i": _emscripten_asm_const_i, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT };
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
  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

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
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
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
  var _emscripten_asm_const_v=env._emscripten_asm_const_v;
  var ___setErrNo=env.___setErrNo;
  var _abort=env._abort;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _emscripten_asm_const_i=env._emscripten_asm_const_i;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

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

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _sodium_memzero($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $6 = $2; //@line 89 "libsodium/src/libsodium/sodium/utils.c"
 $4 = $6; //@line 88 "libsodium/src/libsodium/sodium/utils.c"
 $5 = 0; //@line 90 "libsodium/src/libsodium/sodium/utils.c"
 while(1) {
  $7 = $5; //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  $8 = $3; //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  $9 = ($7>>>0)<($8>>>0); //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  if (!($9)) {
   break;
  }
  $10 = $5; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $11 = (($10) + 1)|0; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $5 = $11; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $12 = $4; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $13 = (($12) + ($10)|0); //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  HEAP8[$13>>0] = 0; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
 }
 STACKTOP = sp;return; //@line 96 "libsodium/src/libsodium/sodium/utils.c"
}
function _randombytes_random() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = _emscripten_asm_const_i(0)|0; //@line 70 "libsodium/src/libsodium/randombytes/randombytes.c"
 return ($0|0); //@line 70 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _randombytes_stir() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _emscripten_asm_const_v(1); //@line 85 "libsodium/src/libsodium/randombytes/randombytes.c"
 return; //@line 113 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _randombytes_buf($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $6 = $2; //@line 151 "libsodium/src/libsodium/randombytes/randombytes.c"
 $4 = $6; //@line 151 "libsodium/src/libsodium/randombytes/randombytes.c"
 $5 = 0; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
 while(1) {
  $7 = $5; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $8 = $3; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $9 = ($7>>>0)<($8>>>0); //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  if (!($9)) {
   break;
  }
  $10 = (_randombytes_random()|0); //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $11 = $10&255; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $12 = $5; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $13 = $4; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $14 = (($13) + ($12)|0); //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  HEAP8[$14>>0] = $11; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $15 = $5; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $16 = (($15) + 1)|0; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $5 = $16; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
 }
 STACKTOP = sp;return; //@line 158 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _crypto_stream_chacha20($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $6 = sp;
 $5 = $0;
 $9 = $6;
 $10 = $9;
 HEAP32[$10>>2] = $1;
 $11 = (($9) + 4)|0;
 $12 = $11;
 HEAP32[$12>>2] = $2;
 $7 = $3;
 $8 = $4;
 $13 = HEAP32[2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $14 = HEAP32[$13>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $15 = $5; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $16 = $6; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $17 = $16; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $18 = HEAP32[$17>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $19 = (($16) + 4)|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $20 = $19; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $21 = HEAP32[$20>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $22 = $7; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $23 = $8; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $24 = (FUNCTION_TABLE_iiiiii[$14 & 31]($15,$18,$21,$22,$23)|0); //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 STACKTOP = sp;return ($24|0); //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
}
function _stream_ref($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(96|0);
 $7 = sp;
 $10 = sp + 8|0;
 $6 = $0;
 $11 = $7;
 $12 = $11;
 HEAP32[$12>>2] = $1;
 $13 = (($11) + 4)|0;
 $14 = $13;
 HEAP32[$14>>2] = $2;
 $8 = $3;
 $9 = $4;
 $15 = $7; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = $15; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = HEAP32[$16>>2]|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = (($15) + 4)|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $18; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = HEAP32[$19>>2]|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = ($17|0)!=(0); //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = ($20|0)!=(0); //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $21 | $22; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($23) {
  $24 = $9; //@line 234 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($10,$24); //@line 234 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = $8; //@line 235 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ivsetup($10,$25,0); //@line 235 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = $6; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $7; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = $27; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = HEAP32[$28>>2]|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = (($27) + 4)|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $30; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = HEAP32[$31>>2]|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _memset(($26|0),0,($29|0))|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $6; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = $6; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $7; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = $35; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = HEAP32[$36>>2]|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $38 = (($35) + 4)|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $39 = $38; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = HEAP32[$39>>2]|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($10,$33,$34,$37,$40); //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($10,64); //@line 238 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $5 = 0; //@line 240 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = $5; //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($41|0); //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $5 = 0; //@line 231 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = $5; //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($41|0); //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _stream_ietf_ref($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(96|0);
 $7 = sp;
 $10 = sp + 8|0;
 $6 = $0;
 $11 = $7;
 $12 = $11;
 HEAP32[$12>>2] = $1;
 $13 = (($11) + 4)|0;
 $14 = $13;
 HEAP32[$14>>2] = $2;
 $8 = $3;
 $9 = $4;
 $15 = $7; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = $15; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = HEAP32[$16>>2]|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = (($15) + 4)|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $18; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = HEAP32[$19>>2]|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = ($17|0)!=(0); //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = ($20|0)!=(0); //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $21 | $22; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($23) {
  $24 = $9; //@line 253 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($10,$24); //@line 253 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = $8; //@line 254 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ietf_ivsetup($10,$25,0); //@line 254 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = $6; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $7; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = $27; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = HEAP32[$28>>2]|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = (($27) + 4)|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $30; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = HEAP32[$31>>2]|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _memset(($26|0),0,($29|0))|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $6; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = $6; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $7; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = $35; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = HEAP32[$36>>2]|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $38 = (($35) + 4)|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $39 = $38; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = HEAP32[$39>>2]|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($10,$33,$34,$37,$40); //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($10,64); //@line 257 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $5 = 0; //@line 259 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = $5; //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($41|0); //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $5 = 0; //@line 250 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = $5; //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($41|0); //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _stream_ref_xor_ic($0,$1,$2,$3,$4,$5,$6,$7) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 $7 = $7|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $60 = 0, $61 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $11 = sp + 8|0;
 $13 = sp;
 $15 = sp + 24|0;
 $16 = sp + 112|0;
 $9 = $0;
 $10 = $1;
 $19 = $11;
 $20 = $19;
 HEAP32[$20>>2] = $2;
 $21 = (($19) + 4)|0;
 $22 = $21;
 HEAP32[$22>>2] = $3;
 $12 = $4;
 $23 = $13;
 $24 = $23;
 HEAP32[$24>>2] = $5;
 $25 = (($23) + 4)|0;
 $26 = $25;
 HEAP32[$26>>2] = $6;
 $14 = $7;
 $27 = $11; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $27; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = HEAP32[$28>>2]|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $30 = (($27) + 4)|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = $30; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = HEAP32[$31>>2]|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = ($29|0)!=(0); //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = ($32|0)!=(0); //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = $33 | $34; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($35) {
  $36 = $13; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $36; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $38 = HEAP32[$37>>2]|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $39 = (($36) + 4)|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = $39; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = HEAP32[$40>>2]|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = $41; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $42 = $13; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $43 = $42; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $44 = HEAP32[$43>>2]|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $45 = (($42) + 4)|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $46 = $45; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $47 = HEAP32[$46>>2]|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $18 = $44; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $48 = $18; //@line 278 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($16,$48); //@line 278 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $49 = ((($16)) + 4|0); //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $50 = $17; //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($49,$50); //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $51 = $14; //@line 280 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($15,$51); //@line 280 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $52 = $12; //@line 281 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ivsetup($15,$52,$16); //@line 281 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $53 = $10; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $54 = $9; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $55 = $11; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $56 = $55; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $57 = HEAP32[$56>>2]|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $58 = (($55) + 4)|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $59 = $58; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $60 = HEAP32[$59>>2]|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($15,$53,$54,$57,$60); //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($15,64); //@line 283 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $8 = 0; //@line 285 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $61 = $8; //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($61|0); //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $8 = 0; //@line 274 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $61 = $8; //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($61|0); //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _stream_ietf_ref_xor_ic($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(112|0);
 $10 = sp;
 $14 = sp + 8|0;
 $15 = sp + 96|0;
 $8 = $0;
 $9 = $1;
 $16 = $10;
 $17 = $16;
 HEAP32[$17>>2] = $2;
 $18 = (($16) + 4)|0;
 $19 = $18;
 HEAP32[$19>>2] = $3;
 $11 = $4;
 $12 = $5;
 $13 = $6;
 $20 = $10; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = $20; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = HEAP32[$21>>2]|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = (($20) + 4)|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = $23; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = HEAP32[$24>>2]|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ($22|0)!=(0); //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = ($25|0)!=(0); //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $26 | $27; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($28) {
  $29 = $12; //@line 300 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($15,$29); //@line 300 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = $13; //@line 301 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($14,$30); //@line 301 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $11; //@line 302 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ietf_ivsetup($14,$31,$15); //@line 302 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $9; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $8; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = $10; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = (($34) + 4)|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $38 = $37; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $39 = HEAP32[$38>>2]|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($14,$32,$33,$36,$39); //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($14,64); //@line 304 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $7 = 0; //@line 306 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = $7; //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($40|0); //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $7 = 0; //@line 298 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = $7; //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($40|0); //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _store32_le($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $3; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $5 = $4&255; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $6 = $2; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$6>>0] = $5; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $7 = $3; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $8 = $7 >>> 8; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $8; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $9 = $3; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $10 = $9&255; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $11 = $2; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $12 = ((($11)) + 1|0); //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$12>>0] = $10; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $13 = $3; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $14 = $13 >>> 8; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $14; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $15 = $3; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $16 = $15&255; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $17 = $2; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $18 = ((($17)) + 2|0); //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$18>>0] = $16; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $19 = $3; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $20 = $19 >>> 8; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $20; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $21 = $3; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $22 = $21&255; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $23 = $2; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $24 = ((($23)) + 3|0); //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$24>>0] = $22; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 STACKTOP = sp;return; //@line 76 "libsodium/src/libsodium/include/sodium/private/common.h"
}
function _chacha_keysetup($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $2; //@line 50 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$4>>2] = 1634760805; //@line 50 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $5 = $2; //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $6 = ((($5)) + 4|0); //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$6>>2] = 857760878; //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $7 = $2; //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 8|0); //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = 2036477234; //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $9 = $2; //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = ((($9)) + 12|0); //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$10>>2] = 1797285236; //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = $3; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = (_load32_le($11)|0); //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = $2; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = ((($13)) + 16|0); //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$14>>2] = $12; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = $3; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = ((($15)) + 4|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = (_load32_le($16)|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $2; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = ((($18)) + 20|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$19>>2] = $17; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $3; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = ((($20)) + 8|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = (_load32_le($21)|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $2; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = ((($23)) + 24|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$24>>2] = $22; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = $3; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ((($25)) + 12|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = (_load32_le($26)|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $2; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = ((($28)) + 28|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$29>>2] = $27; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $30 = $3; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = ((($30)) + 16|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = (_load32_le($31)|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = $2; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = ((($33)) + 32|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$34>>2] = $32; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = $3; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $36 = ((($35)) + 20|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $37 = (_load32_le($36)|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $38 = $2; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $39 = ((($38)) + 36|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$39>>2] = $37; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $40 = $3; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $41 = ((($40)) + 24|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $42 = (_load32_le($41)|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $43 = $2; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $44 = ((($43)) + 40|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$44>>2] = $42; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $45 = $3; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $46 = ((($45)) + 28|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $47 = (_load32_le($46)|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $48 = $2; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $49 = ((($48)) + 44|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$49>>2] = $47; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 62 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _chacha_ietf_ivsetup($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $5; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $7 = ($6|0)==(0|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($7) {
  $12 = 0;
 } else {
  $8 = $5; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = (_load32_le($8)|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $12 = $9;
 }
 $10 = $3; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = ((($10)) + 48|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$11>>2] = $12; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = $4; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = (_load32_le($13)|0); //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = $3; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = ((($15)) + 52|0); //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$16>>2] = $14; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = $4; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ((($17)) + 4|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = (_load32_le($18)|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $3; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = ((($20)) + 56|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$21>>2] = $19; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = $4; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = ((($22)) + 8|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = (_load32_le($23)|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = $3; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ((($25)) + 60|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$26>>2] = $24; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 80 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _chacha_encrypt_bytes($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0;
 var $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0;
 var $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0;
 var $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0;
 var $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0;
 var $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0;
 var $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0;
 var $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0;
 var $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0;
 var $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0;
 var $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0;
 var $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0;
 var $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0;
 var $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0;
 var $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0;
 var $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0;
 var $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0;
 var $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0;
 var $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0;
 var $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0;
 var $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0;
 var $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0;
 var $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0;
 var $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0;
 var $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0;
 var $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0;
 var $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $8 = sp;
 $42 = sp + 160|0;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $44 = $8;
 $45 = $44;
 HEAP32[$45>>2] = $3;
 $46 = (($44) + 4)|0;
 $47 = $46;
 HEAP32[$47>>2] = $4;
 $41 = 0; //@line 87 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $48 = $8; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $49 = $48; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $50 = HEAP32[$49>>2]|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $51 = (($48) + 4)|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $52 = $51; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $53 = HEAP32[$52>>2]|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $54 = ($50|0)!=(0); //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $55 = ($53|0)!=(0); //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $56 = $54 | $55; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if (!($56)) {
  STACKTOP = sp;return; //@line 222 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $57 = $8; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $58 = $57; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $59 = HEAP32[$58>>2]|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $60 = (($57) + 4)|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $61 = $60; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $62 = HEAP32[$61>>2]|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $63 = ($62>>>0)>(63); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $64 = ($59>>>0)>(4294967232); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $65 = ($62|0)==(63); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $66 = $65 & $64; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $67 = $63 | $66; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($67) {
  _abort(); //@line 95 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  // unreachable; //@line 95 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $68 = $5; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $69 = HEAP32[$68>>2]|0; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = $69; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $70 = $5; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $71 = ((($70)) + 4|0); //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $72 = HEAP32[$71>>2]|0; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = $72; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $73 = $5; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $74 = ((($73)) + 8|0); //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $75 = HEAP32[$74>>2]|0; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = $75; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $76 = $5; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $77 = ((($76)) + 12|0); //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $78 = HEAP32[$77>>2]|0; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $78; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $79 = $5; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $80 = ((($79)) + 16|0); //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $81 = HEAP32[$80>>2]|0; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = $81; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $82 = $5; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $83 = ((($82)) + 20|0); //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $84 = HEAP32[$83>>2]|0; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $30 = $84; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $85 = $5; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $86 = ((($85)) + 24|0); //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $87 = HEAP32[$86>>2]|0; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = $87; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $88 = $5; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $89 = ((($88)) + 28|0); //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $90 = HEAP32[$89>>2]|0; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = $90; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $91 = $5; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $92 = ((($91)) + 32|0); //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $93 = HEAP32[$92>>2]|0; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = $93; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $94 = $5; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $95 = ((($94)) + 36|0); //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $96 = HEAP32[$95>>2]|0; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = $96; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $97 = $5; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $98 = ((($97)) + 40|0); //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $99 = HEAP32[$98>>2]|0; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = $99; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $100 = $5; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $101 = ((($100)) + 44|0); //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $102 = HEAP32[$101>>2]|0; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $36 = $102; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $103 = $5; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $104 = ((($103)) + 48|0); //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $105 = HEAP32[$104>>2]|0; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $37 = $105; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $106 = $5; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $107 = ((($106)) + 52|0); //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $108 = HEAP32[$107>>2]|0; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $38 = $108; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $109 = $5; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $110 = ((($109)) + 56|0); //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $111 = HEAP32[$110>>2]|0; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $39 = $111; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $112 = $5; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $113 = ((($112)) + 60|0); //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $114 = HEAP32[$113>>2]|0; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $40 = $114; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 while(1) {
  $115 = $8; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $116 = $115; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $117 = HEAP32[$116>>2]|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $118 = (($115) + 4)|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $119 = $118; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $120 = HEAP32[$119>>2]|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $121 = ($120>>>0)<(0); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $122 = ($117>>>0)<(64); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $123 = ($120|0)==(0); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $124 = $123 & $122; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $125 = $121 | $124; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if ($125) {
   dest=$42; stop=dest+64|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0)); //@line 116 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $43 = 0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   while(1) {
    $126 = $43; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $127 = $8; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $128 = $127; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $129 = HEAP32[$128>>2]|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $130 = (($127) + 4)|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $131 = $130; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $132 = HEAP32[$131>>2]|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $133 = (0)<($132>>>0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $134 = ($126>>>0)<($129>>>0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $135 = (0)==($132|0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $136 = $135 & $134; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $137 = $133 | $136; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    if (!($137)) {
     break;
    }
    $138 = $43; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $139 = $6; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $140 = (($139) + ($138)|0); //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $141 = HEAP8[$140>>0]|0; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $142 = $43; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $143 = (($42) + ($142)|0); //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    HEAP8[$143>>0] = $141; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $144 = $43; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $145 = (($144) + 1)|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $43 = $145; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   }
   $6 = $42; //@line 120 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $146 = $7; //@line 121 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $41 = $146; //@line 121 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $7 = $42; //@line 122 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $147 = $25; //@line 124 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $147; //@line 124 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $148 = $26; //@line 125 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $10 = $148; //@line 125 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $149 = $27; //@line 126 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $11 = $149; //@line 126 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $150 = $28; //@line 127 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $12 = $150; //@line 127 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $151 = $29; //@line 128 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $13 = $151; //@line 128 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $152 = $30; //@line 129 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $14 = $152; //@line 129 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $153 = $31; //@line 130 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $15 = $153; //@line 130 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $154 = $32; //@line 131 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $16 = $154; //@line 131 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $155 = $33; //@line 132 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = $155; //@line 132 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $156 = $34; //@line 133 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $18 = $156; //@line 133 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $157 = $35; //@line 134 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $19 = $157; //@line 134 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $158 = $36; //@line 135 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $20 = $158; //@line 135 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $159 = $37; //@line 136 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $159; //@line 136 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $160 = $38; //@line 137 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $160; //@line 137 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $161 = $39; //@line 138 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $161; //@line 138 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $162 = $40; //@line 139 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $162; //@line 139 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $43 = 20; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  while(1) {
   $163 = $43; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $164 = ($163>>>0)>(0); //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $165 = $9; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   if (!($164)) {
    break;
   }
   $166 = $13; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $167 = (($165) + ($166))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $9 = $167; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $168 = $21; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $169 = $9; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $170 = $168 ^ $169; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $171 = $170 << 16; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $172 = $21; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $173 = $9; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $174 = $172 ^ $173; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $175 = $174 >>> 16; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $176 = $171 | $175; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $21 = $176; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $177 = $17; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $178 = $21; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $179 = (($177) + ($178))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $17 = $179; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $180 = $13; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $181 = $17; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $182 = $180 ^ $181; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $183 = $182 << 12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $184 = $13; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $185 = $17; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $186 = $184 ^ $185; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $187 = $186 >>> 20; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $188 = $183 | $187; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $13 = $188; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $189 = $9; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $190 = $13; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $191 = (($189) + ($190))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $9 = $191; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $192 = $21; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $193 = $9; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $194 = $192 ^ $193; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $195 = $194 << 8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $196 = $21; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $197 = $9; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $198 = $196 ^ $197; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $199 = $198 >>> 24; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $200 = $195 | $199; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $21 = $200; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $201 = $17; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $202 = $21; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $203 = (($201) + ($202))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $17 = $203; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $204 = $13; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $205 = $17; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $206 = $204 ^ $205; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $207 = $206 << 7; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $208 = $13; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $209 = $17; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $210 = $208 ^ $209; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $211 = $210 >>> 25; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $212 = $207 | $211; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $13 = $212; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $213 = $10; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $214 = $14; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $215 = (($213) + ($214))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $10 = $215; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $216 = $22; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $217 = $10; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $218 = $216 ^ $217; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $219 = $218 << 16; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $220 = $22; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $221 = $10; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $222 = $220 ^ $221; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $223 = $222 >>> 16; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $224 = $219 | $223; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $22 = $224; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $225 = $18; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $226 = $22; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $227 = (($225) + ($226))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $18 = $227; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $228 = $14; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $229 = $18; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $230 = $228 ^ $229; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $231 = $230 << 12; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $232 = $14; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $233 = $18; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $234 = $232 ^ $233; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $235 = $234 >>> 20; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $236 = $231 | $235; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $14 = $236; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $237 = $10; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $238 = $14; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $239 = (($237) + ($238))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $10 = $239; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $240 = $22; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $241 = $10; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $242 = $240 ^ $241; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $243 = $242 << 8; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $244 = $22; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $245 = $10; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $246 = $244 ^ $245; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $247 = $246 >>> 24; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $248 = $243 | $247; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $22 = $248; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $249 = $18; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $250 = $22; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $251 = (($249) + ($250))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $18 = $251; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $252 = $14; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $253 = $18; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $254 = $252 ^ $253; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $255 = $254 << 7; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $256 = $14; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $257 = $18; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $258 = $256 ^ $257; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $259 = $258 >>> 25; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $260 = $255 | $259; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $14 = $260; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $261 = $11; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $262 = $15; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $263 = (($261) + ($262))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $11 = $263; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $264 = $23; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $265 = $11; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $266 = $264 ^ $265; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $267 = $266 << 16; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $268 = $23; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $269 = $11; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $270 = $268 ^ $269; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $271 = $270 >>> 16; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $272 = $267 | $271; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $23 = $272; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $273 = $19; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $274 = $23; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $275 = (($273) + ($274))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $19 = $275; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $276 = $15; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $277 = $19; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $278 = $276 ^ $277; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $279 = $278 << 12; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $280 = $15; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $281 = $19; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $282 = $280 ^ $281; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $283 = $282 >>> 20; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $284 = $279 | $283; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $15 = $284; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $285 = $11; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $286 = $15; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $287 = (($285) + ($286))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $11 = $287; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $288 = $23; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $289 = $11; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $290 = $288 ^ $289; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $291 = $290 << 8; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $292 = $23; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $293 = $11; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $294 = $292 ^ $293; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $295 = $294 >>> 24; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $296 = $291 | $295; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $23 = $296; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $297 = $19; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $298 = $23; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $299 = (($297) + ($298))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $19 = $299; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $300 = $15; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $301 = $19; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $302 = $300 ^ $301; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $303 = $302 << 7; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $304 = $15; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $305 = $19; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $306 = $304 ^ $305; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $307 = $306 >>> 25; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $308 = $303 | $307; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $15 = $308; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $309 = $12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $310 = $16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $311 = (($309) + ($310))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $12 = $311; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $312 = $24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $313 = $12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $314 = $312 ^ $313; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $315 = $314 << 16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $316 = $24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $317 = $12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $318 = $316 ^ $317; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $319 = $318 >>> 16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $320 = $315 | $319; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $24 = $320; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $321 = $20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $322 = $24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $323 = (($321) + ($322))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $20 = $323; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $324 = $16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $325 = $20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $326 = $324 ^ $325; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $327 = $326 << 12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $328 = $16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $329 = $20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $330 = $328 ^ $329; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $331 = $330 >>> 20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $332 = $327 | $331; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $16 = $332; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $333 = $12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $334 = $16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $335 = (($333) + ($334))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $12 = $335; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $336 = $24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $337 = $12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $338 = $336 ^ $337; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $339 = $338 << 8; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $340 = $24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $341 = $12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $342 = $340 ^ $341; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $343 = $342 >>> 24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $344 = $339 | $343; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $24 = $344; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $345 = $20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $346 = $24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $347 = (($345) + ($346))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $20 = $347; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $348 = $16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $349 = $20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $350 = $348 ^ $349; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $351 = $350 << 7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $352 = $16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $353 = $20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $354 = $352 ^ $353; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $355 = $354 >>> 25; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $356 = $351 | $355; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $16 = $356; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $357 = $9; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $358 = $14; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $359 = (($357) + ($358))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $9 = $359; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $360 = $24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $361 = $9; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $362 = $360 ^ $361; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $363 = $362 << 16; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $364 = $24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $365 = $9; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $366 = $364 ^ $365; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $367 = $366 >>> 16; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $368 = $363 | $367; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $24 = $368; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $369 = $19; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $370 = $24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $371 = (($369) + ($370))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $19 = $371; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $372 = $14; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $373 = $19; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $374 = $372 ^ $373; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $375 = $374 << 12; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $376 = $14; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $377 = $19; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $378 = $376 ^ $377; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $379 = $378 >>> 20; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $380 = $375 | $379; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $14 = $380; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $381 = $9; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $382 = $14; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $383 = (($381) + ($382))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $9 = $383; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $384 = $24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $385 = $9; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $386 = $384 ^ $385; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $387 = $386 << 8; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $388 = $24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $389 = $9; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $390 = $388 ^ $389; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $391 = $390 >>> 24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $392 = $387 | $391; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $24 = $392; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $393 = $19; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $394 = $24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $395 = (($393) + ($394))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $19 = $395; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $396 = $14; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $397 = $19; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $398 = $396 ^ $397; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $399 = $398 << 7; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $400 = $14; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $401 = $19; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $402 = $400 ^ $401; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $403 = $402 >>> 25; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $404 = $399 | $403; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $14 = $404; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $405 = $10; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $406 = $15; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $407 = (($405) + ($406))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $10 = $407; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $408 = $21; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $409 = $10; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $410 = $408 ^ $409; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $411 = $410 << 16; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $412 = $21; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $413 = $10; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $414 = $412 ^ $413; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $415 = $414 >>> 16; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $416 = $411 | $415; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $21 = $416; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $417 = $20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $418 = $21; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $419 = (($417) + ($418))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $20 = $419; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $420 = $15; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $421 = $20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $422 = $420 ^ $421; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $423 = $422 << 12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $424 = $15; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $425 = $20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $426 = $424 ^ $425; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $427 = $426 >>> 20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $428 = $423 | $427; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $15 = $428; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $429 = $10; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $430 = $15; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $431 = (($429) + ($430))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $10 = $431; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $432 = $21; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $433 = $10; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $434 = $432 ^ $433; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $435 = $434 << 8; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $436 = $21; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $437 = $10; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $438 = $436 ^ $437; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $439 = $438 >>> 24; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $440 = $435 | $439; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $21 = $440; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $441 = $20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $442 = $21; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $443 = (($441) + ($442))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $20 = $443; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $444 = $15; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $445 = $20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $446 = $444 ^ $445; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $447 = $446 << 7; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $448 = $15; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $449 = $20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $450 = $448 ^ $449; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $451 = $450 >>> 25; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $452 = $447 | $451; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $15 = $452; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $453 = $11; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $454 = $16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $455 = (($453) + ($454))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $11 = $455; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $456 = $22; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $457 = $11; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $458 = $456 ^ $457; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $459 = $458 << 16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $460 = $22; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $461 = $11; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $462 = $460 ^ $461; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $463 = $462 >>> 16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $464 = $459 | $463; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $22 = $464; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $465 = $17; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $466 = $22; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $467 = (($465) + ($466))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $17 = $467; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $468 = $16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $469 = $17; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $470 = $468 ^ $469; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $471 = $470 << 12; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $472 = $16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $473 = $17; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $474 = $472 ^ $473; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $475 = $474 >>> 20; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $476 = $471 | $475; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $16 = $476; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $477 = $11; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $478 = $16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $479 = (($477) + ($478))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $11 = $479; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $480 = $22; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $481 = $11; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $482 = $480 ^ $481; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $483 = $482 << 8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $484 = $22; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $485 = $11; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $486 = $484 ^ $485; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $487 = $486 >>> 24; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $488 = $483 | $487; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $22 = $488; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $489 = $17; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $490 = $22; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $491 = (($489) + ($490))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $17 = $491; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $492 = $16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $493 = $17; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $494 = $492 ^ $493; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $495 = $494 << 7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $496 = $16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $497 = $17; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $498 = $496 ^ $497; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $499 = $498 >>> 25; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $500 = $495 | $499; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $16 = $500; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $501 = $12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $502 = $13; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $503 = (($501) + ($502))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $12 = $503; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $504 = $23; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $505 = $12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $506 = $504 ^ $505; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $507 = $506 << 16; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $508 = $23; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $509 = $12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $510 = $508 ^ $509; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $511 = $510 >>> 16; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $512 = $507 | $511; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $23 = $512; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $513 = $18; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $514 = $23; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $515 = (($513) + ($514))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $18 = $515; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $516 = $13; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $517 = $18; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $518 = $516 ^ $517; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $519 = $518 << 12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $520 = $13; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $521 = $18; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $522 = $520 ^ $521; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $523 = $522 >>> 20; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $524 = $519 | $523; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $13 = $524; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $525 = $12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $526 = $13; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $527 = (($525) + ($526))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $12 = $527; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $528 = $23; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $529 = $12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $530 = $528 ^ $529; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $531 = $530 << 8; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $532 = $23; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $533 = $12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $534 = $532 ^ $533; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $535 = $534 >>> 24; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $536 = $531 | $535; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $23 = $536; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $537 = $18; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $538 = $23; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $539 = (($537) + ($538))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $18 = $539; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $540 = $13; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $541 = $18; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $542 = $540 ^ $541; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $543 = $542 << 7; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $544 = $13; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $545 = $18; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $546 = $544 ^ $545; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $547 = $546 >>> 25; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $548 = $543 | $547; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $13 = $548; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $549 = $43; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $550 = (($549) - 2)|0; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $43 = $550; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $551 = $25; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $552 = (($165) + ($551))|0; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $552; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $553 = $10; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $554 = $26; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $555 = (($553) + ($554))|0; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $10 = $555; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $556 = $11; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $557 = $27; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $558 = (($556) + ($557))|0; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $11 = $558; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $559 = $12; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $560 = $28; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $561 = (($559) + ($560))|0; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $12 = $561; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $562 = $13; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $563 = $29; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $564 = (($562) + ($563))|0; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $13 = $564; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $565 = $14; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $566 = $30; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $567 = (($565) + ($566))|0; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $14 = $567; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $568 = $15; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $569 = $31; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $570 = (($568) + ($569))|0; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $15 = $570; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $571 = $16; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $572 = $32; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $573 = (($571) + ($572))|0; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $16 = $573; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $574 = $17; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $575 = $33; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $576 = (($574) + ($575))|0; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = $576; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $577 = $18; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $578 = $34; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $579 = (($577) + ($578))|0; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $18 = $579; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $580 = $19; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $581 = $35; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $582 = (($580) + ($581))|0; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $19 = $582; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $583 = $20; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $584 = $36; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $585 = (($583) + ($584))|0; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $20 = $585; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $586 = $21; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $587 = $37; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $588 = (($586) + ($587))|0; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $588; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $589 = $22; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $590 = $38; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $591 = (($589) + ($590))|0; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $591; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $592 = $23; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $593 = $39; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $594 = (($592) + ($593))|0; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $594; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $595 = $24; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $596 = $40; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $597 = (($595) + ($596))|0; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $597; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $598 = $9; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $599 = $6; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $600 = (_load32_le($599)|0); //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $601 = $598 ^ $600; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $601; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $602 = $10; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $603 = $6; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $604 = ((($603)) + 4|0); //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $605 = (_load32_le($604)|0); //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $606 = $602 ^ $605; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $10 = $606; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $607 = $11; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $608 = $6; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $609 = ((($608)) + 8|0); //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $610 = (_load32_le($609)|0); //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $611 = $607 ^ $610; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $11 = $611; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $612 = $12; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $613 = $6; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $614 = ((($613)) + 12|0); //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $615 = (_load32_le($614)|0); //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $616 = $612 ^ $615; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $12 = $616; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $617 = $13; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $618 = $6; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $619 = ((($618)) + 16|0); //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $620 = (_load32_le($619)|0); //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $621 = $617 ^ $620; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $13 = $621; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $622 = $14; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $623 = $6; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $624 = ((($623)) + 20|0); //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $625 = (_load32_le($624)|0); //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $626 = $622 ^ $625; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $14 = $626; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $627 = $15; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $628 = $6; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $629 = ((($628)) + 24|0); //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $630 = (_load32_le($629)|0); //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $631 = $627 ^ $630; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $15 = $631; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $632 = $16; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $633 = $6; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $634 = ((($633)) + 28|0); //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $635 = (_load32_le($634)|0); //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $636 = $632 ^ $635; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $16 = $636; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $637 = $17; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $638 = $6; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $639 = ((($638)) + 32|0); //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $640 = (_load32_le($639)|0); //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $641 = $637 ^ $640; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = $641; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $642 = $18; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $643 = $6; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $644 = ((($643)) + 36|0); //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $645 = (_load32_le($644)|0); //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $646 = $642 ^ $645; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $18 = $646; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $647 = $19; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $648 = $6; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $649 = ((($648)) + 40|0); //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $650 = (_load32_le($649)|0); //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $651 = $647 ^ $650; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $19 = $651; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $652 = $20; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $653 = $6; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $654 = ((($653)) + 44|0); //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $655 = (_load32_le($654)|0); //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $656 = $652 ^ $655; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $20 = $656; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $657 = $21; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $658 = $6; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $659 = ((($658)) + 48|0); //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $660 = (_load32_le($659)|0); //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $661 = $657 ^ $660; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $661; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $662 = $22; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $663 = $6; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $664 = ((($663)) + 52|0); //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $665 = (_load32_le($664)|0); //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $666 = $662 ^ $665; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $666; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $667 = $23; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $668 = $6; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $669 = ((($668)) + 56|0); //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $670 = (_load32_le($669)|0); //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $671 = $667 ^ $670; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $671; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $672 = $24; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $673 = $6; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $674 = ((($673)) + 60|0); //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $675 = (_load32_le($674)|0); //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $676 = $672 ^ $675; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $676; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $677 = $37; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $678 = (($677) + 1)|0; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $678; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $679 = $37; //@line 186 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $680 = ($679|0)!=(0); //@line 186 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if (!($680)) {
   $681 = $38; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $682 = (($681) + 1)|0; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $38 = $682; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $683 = $7; //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $684 = $9; //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($683,$684); //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $685 = $7; //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $686 = ((($685)) + 4|0); //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $687 = $10; //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($686,$687); //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $688 = $7; //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $689 = ((($688)) + 8|0); //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $690 = $11; //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($689,$690); //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $691 = $7; //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $692 = ((($691)) + 12|0); //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $693 = $12; //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($692,$693); //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $694 = $7; //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $695 = ((($694)) + 16|0); //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $696 = $13; //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($695,$696); //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $697 = $7; //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $698 = ((($697)) + 20|0); //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $699 = $14; //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($698,$699); //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $700 = $7; //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $701 = ((($700)) + 24|0); //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $702 = $15; //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($701,$702); //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $703 = $7; //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $704 = ((($703)) + 28|0); //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $705 = $16; //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($704,$705); //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $706 = $7; //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $707 = ((($706)) + 32|0); //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $708 = $17; //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($707,$708); //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $709 = $7; //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $710 = ((($709)) + 36|0); //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $711 = $18; //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($710,$711); //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $712 = $7; //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $713 = ((($712)) + 40|0); //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $714 = $19; //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($713,$714); //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $715 = $7; //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $716 = ((($715)) + 44|0); //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $717 = $20; //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($716,$717); //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $718 = $7; //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $719 = ((($718)) + 48|0); //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $720 = $21; //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($719,$720); //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $721 = $7; //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $722 = ((($721)) + 52|0); //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $723 = $22; //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($722,$723); //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $724 = $7; //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $725 = ((($724)) + 56|0); //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $726 = $23; //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($725,$726); //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $727 = $7; //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $728 = ((($727)) + 60|0); //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $729 = $24; //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($728,$729); //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $730 = $8; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $731 = $730; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $732 = HEAP32[$731>>2]|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $733 = (($730) + 4)|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $734 = $733; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $735 = HEAP32[$734>>2]|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $736 = ($735>>>0)<(0); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $737 = ($732>>>0)<=(64); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $738 = ($735|0)==(0); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $739 = $738 & $737; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $740 = $736 | $739; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $741 = $8; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $742 = $741; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $743 = HEAP32[$742>>2]|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $744 = (($741) + 4)|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $745 = $744; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $746 = HEAP32[$745>>2]|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if ($740) {
   break;
  }
  $775 = (_i64Subtract(($743|0),($746|0),64,0)|0); //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $776 = tempRet0; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $777 = $8; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $778 = $777; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  HEAP32[$778>>2] = $775; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $779 = (($777) + 4)|0; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $780 = $779; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  HEAP32[$780>>2] = $776; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $781 = $7; //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $782 = ((($781)) + 64|0); //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $7 = $782; //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $783 = $6; //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $784 = ((($783)) + 64|0); //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $6 = $784; //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $747 = ($746>>>0)<(0); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $748 = ($743>>>0)<(64); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $749 = ($746|0)==(0); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $750 = $749 & $748; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $751 = $747 | $750; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 L25: do {
  if ($751) {
   $43 = 0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   while(1) {
    $752 = $43; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $753 = $8; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $754 = $753; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $755 = HEAP32[$754>>2]|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $756 = (($753) + 4)|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $757 = $756; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $758 = HEAP32[$757>>2]|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $759 = ($752>>>0)<($755>>>0); //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    if (!($759)) {
     break L25;
    }
    $760 = $43; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $761 = $7; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $762 = (($761) + ($760)|0); //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $763 = HEAP8[$762>>0]|0; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $764 = $43; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $765 = $41; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $766 = (($765) + ($764)|0); //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    HEAP8[$766>>0] = $763; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $767 = $43; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $768 = (($767) + 1)|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $43 = $768; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   }
  }
 } while(0);
 $769 = $37; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $770 = $5; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $771 = ((($770)) + 48|0); //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$771>>2] = $769; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $772 = $38; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $773 = $5; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $774 = ((($773)) + 52|0); //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$774>>2] = $772; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 222 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _load32_le($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $3 = $1; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $4 = HEAP8[$3>>0]|0; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $5 = $4&255; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $2 = $5; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $6 = $1; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $7 = ((($6)) + 1|0); //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $8 = HEAP8[$7>>0]|0; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $9 = $8&255; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $10 = $9 << 8; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $11 = $2; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $12 = $11 | $10; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $2 = $12; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $13 = $1; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $14 = ((($13)) + 2|0); //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $15 = HEAP8[$14>>0]|0; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $16 = $15&255; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $17 = $16 << 16; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $18 = $2; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $19 = $18 | $17; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $2 = $19; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $20 = $1; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $21 = ((($20)) + 3|0); //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $22 = HEAP8[$21>>0]|0; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $23 = $22&255; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $24 = $23 << 24; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $25 = $2; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $26 = $25 | $24; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $2 = $26; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $27 = $2; //@line 60 "libsodium/src/libsodium/include/sodium/private/common.h"
 STACKTOP = sp;return ($27|0); //@line 60 "libsodium/src/libsodium/include/sodium/private/common.h"
}
function _chacha_ivsetup($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $5; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $7 = ($6|0)==(0|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($7) {
  $12 = 0;
 } else {
  $8 = $5; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = (_load32_le($8)|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $12 = $9;
 }
 $10 = $3; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = ((($10)) + 48|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$11>>2] = $12; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = $5; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = ($13|0)==(0|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($14) {
  $20 = 0;
 } else {
  $15 = $5; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $16 = ((($15)) + 4|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = (_load32_le($16)|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $20 = $17;
 }
 $18 = $3; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = ((($18)) + 52|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$19>>2] = $20; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = $4; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = (_load32_le($21)|0); //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $3; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = ((($23)) + 56|0); //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$24>>2] = $22; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = $4; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ((($25)) + 4|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = (_load32_le($26)|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $3; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = ((($28)) + 60|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$29>>2] = $27; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 71 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _reduce12289($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 $5 = $2;
 $6 = $5;
 HEAP32[$6>>2] = $0;
 $7 = (($5) + 4)|0;
 $8 = $7;
 HEAP32[$8>>2] = $1;
 $9 = $2; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $10 = $9; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = HEAP32[$10>>2]|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $12 = (($9) + 4)|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $13 = $12; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $14 = HEAP32[$13>>2]|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $15 = $11 & 4095; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $3 = $15; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $16 = $2; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $17 = $16; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $18 = HEAP32[$17>>2]|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $19 = (($16) + 4)|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $20 = $19; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = HEAP32[$20>>2]|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $22 = (_bitshift64Ashr(($18|0),($21|0),12)|0); //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $23 = tempRet0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $4 = $22; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $24 = $3; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $25 = ($24*3)|0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $26 = $4; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $27 = (($25) - ($26))|0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 STACKTOP = sp;return ($27|0); //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _reduce12289_2x($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $2 = sp;
 $6 = $2;
 $7 = $6;
 HEAP32[$7>>2] = $0;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = $1;
 $10 = $2; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = $10; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $12 = HEAP32[$11>>2]|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $13 = (($10) + 4)|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $14 = $13; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $15 = HEAP32[$14>>2]|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $16 = $12 & 4095; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $3 = $16; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $17 = $2; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $18 = $17; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $19 = HEAP32[$18>>2]|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $20 = (($17) + 4)|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = $20; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $22 = HEAP32[$21>>2]|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $23 = (_bitshift64Ashr(($19|0),($22|0),12)|0); //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $24 = tempRet0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $25 = $23 & 4095; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $4 = $25; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $26 = $2; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $27 = $26; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $28 = HEAP32[$27>>2]|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $29 = (($26) + 4)|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $30 = $29; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $31 = HEAP32[$30>>2]|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $32 = (_bitshift64Ashr(($28|0),($31|0),24)|0); //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $33 = tempRet0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $5 = $32; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $34 = $3; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $35 = ($34*9)|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $36 = $4; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $37 = ($36*3)|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $38 = (($35) - ($37))|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $39 = $5; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $40 = (($38) + ($39))|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 STACKTOP = sp;return ($40|0); //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _NTT_CT_std2rev_12289($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $15 = $5; //@line 41 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = $15; //@line 41 "LatticeCrypto_v1.0/generic/ntt.c"
 $6 = 1; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $16 = $6; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = ($16>>>0)<(128); //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($17)) {
   break;
  }
  $18 = $11; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $18 >>> 1; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = $19; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = 0; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $20 = $7; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $21 = $6; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $22 = ($20>>>0)<($21>>>0); //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($22)) {
    break;
   }
   $23 = $7; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $24 = $23<<1; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $25 = $11; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $26 = Math_imul($24, $25)|0; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $9 = $26; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $27 = $9; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $28 = $11; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $29 = (($27) + ($28))|0; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $30 = (($29) - 1)|0; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $10 = $30; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $31 = $6; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $32 = $7; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $33 = (($31) + ($32))|0; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $34 = $4; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $35 = (($34) + ($33<<2)|0); //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $36 = HEAP32[$35>>2]|0; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = $36; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $37 = $9; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   $8 = $37; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $38 = $8; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $39 = $10; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $40 = ($38>>>0)<=($39>>>0); //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($40)) {
     break;
    }
    $41 = $8; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $42 = $3; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $43 = (($42) + ($41<<2)|0); //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $44 = HEAP32[$43>>2]|0; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $13 = $44; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $45 = $8; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $46 = $11; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $47 = (($45) + ($46))|0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $48 = $3; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $49 = (($48) + ($47<<2)|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $50 = HEAP32[$49>>2]|0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $51 = ($50|0)<(0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $52 = $51 << 31 >> 31; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $53 = $12; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $54 = ($53|0)<(0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $55 = $54 << 31 >> 31; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $56 = (___muldi3(($50|0),($52|0),($53|0),($55|0))|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $57 = tempRet0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $58 = (_reduce12289($56,$57)|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $14 = $58; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $59 = $13; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $60 = $14; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $61 = (($59) + ($60))|0; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $62 = $8; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $63 = $3; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $64 = (($63) + ($62<<2)|0); //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$64>>2] = $61; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $65 = $13; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $66 = $14; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $67 = (($65) - ($66))|0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $68 = $8; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $69 = $11; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $70 = (($68) + ($69))|0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $71 = $3; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $72 = (($71) + ($70<<2)|0); //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$72>>2] = $67; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $73 = $8; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $74 = (($73) + 1)|0; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $8 = $74; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $75 = $7; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $76 = (($75) + 1)|0; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $7 = $76; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $77 = $6; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $78 = $77<<1; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $78; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $11 = 4; //@line 59 "LatticeCrypto_v1.0/generic/ntt.c"
 $7 = 0; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $79 = $7; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $80 = ($79>>>0)<(128); //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($80)) {
   break;
  }
  $81 = $7; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $82 = $81<<3; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $82; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $83 = $9; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $84 = (($83) + 3)|0; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $84; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $85 = $7; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $86 = (($85) + 128)|0; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $87 = $4; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $88 = (($87) + ($86<<2)|0); //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $89 = HEAP32[$88>>2]|0; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $89; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $90 = $9; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $90; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $91 = $8; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $92 = $10; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $93 = ($91>>>0)<=($92>>>0); //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($93)) {
    break;
   }
   $94 = $8; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $95 = $3; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $96 = (($95) + ($94<<2)|0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $97 = HEAP32[$96>>2]|0; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $98 = ($97|0)<(0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $99 = $98 << 31 >> 31; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $100 = (_reduce12289($97,$99)|0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $13 = $100; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $101 = $8; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $102 = (($101) + 4)|0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $103 = $3; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $104 = (($103) + ($102<<2)|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $105 = HEAP32[$104>>2]|0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $106 = ($105|0)<(0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $107 = $106 << 31 >> 31; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $108 = $12; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $109 = ($108|0)<(0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $110 = $109 << 31 >> 31; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $111 = (___muldi3(($105|0),($107|0),($108|0),($110|0))|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $112 = tempRet0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $113 = (_reduce12289_2x($111,$112)|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $14 = $113; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $114 = $13; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $115 = $14; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $116 = (($114) + ($115))|0; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $117 = $8; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $118 = $3; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $119 = (($118) + ($117<<2)|0); //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   HEAP32[$119>>2] = $116; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $120 = $13; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $121 = $14; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $122 = (($120) - ($121))|0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $123 = $8; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $124 = (($123) + 4)|0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $125 = $3; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $126 = (($125) + ($124<<2)|0); //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   HEAP32[$126>>2] = $122; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $127 = $8; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $128 = (($127) + 1)|0; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $8 = $128; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $129 = $7; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $130 = (($129) + 1)|0; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $130; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $6 = 256; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $131 = $6; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $132 = $5; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $133 = ($131>>>0)<($132>>>0); //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($133)) {
   break;
  }
  $134 = $11; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $135 = $134 >>> 1; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = $135; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = 0; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $136 = $7; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $137 = $6; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $138 = ($136>>>0)<($137>>>0); //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($138)) {
    break;
   }
   $139 = $7; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $140 = $139<<1; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $141 = $11; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $142 = Math_imul($140, $141)|0; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $9 = $142; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $143 = $9; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $144 = $11; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $145 = (($143) + ($144))|0; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $146 = (($145) - 1)|0; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $10 = $146; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $147 = $6; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $148 = $7; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $149 = (($147) + ($148))|0; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $150 = $4; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $151 = (($150) + ($149<<2)|0); //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $152 = HEAP32[$151>>2]|0; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = $152; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $153 = $9; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   $8 = $153; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $154 = $8; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $155 = $10; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $156 = ($154>>>0)<=($155>>>0); //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($156)) {
     break;
    }
    $157 = $8; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $158 = $3; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $159 = (($158) + ($157<<2)|0); //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $160 = HEAP32[$159>>2]|0; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $13 = $160; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $161 = $8; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $162 = $11; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $163 = (($161) + ($162))|0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $164 = $3; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $165 = (($164) + ($163<<2)|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $166 = HEAP32[$165>>2]|0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $167 = ($166|0)<(0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $168 = $167 << 31 >> 31; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $169 = $12; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $170 = ($169|0)<(0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $171 = $170 << 31 >> 31; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $172 = (___muldi3(($166|0),($168|0),($169|0),($171|0))|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $173 = tempRet0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $174 = (_reduce12289($172,$173)|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $14 = $174; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $175 = $13; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $176 = $14; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $177 = (($175) + ($176))|0; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $178 = $8; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $179 = $3; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $180 = (($179) + ($178<<2)|0); //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$180>>2] = $177; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $181 = $13; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $182 = $14; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $183 = (($181) - ($182))|0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $184 = $8; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $185 = $11; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $186 = (($184) + ($185))|0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $187 = $3; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $188 = (($187) + ($186<<2)|0); //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$188>>2] = $183; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $189 = $8; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $190 = (($189) + 1)|0; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $8 = $190; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $191 = $7; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $192 = (($191) + 1)|0; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $7 = $192; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $193 = $6; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $194 = $193<<1; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $194; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 86 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _INTT_GS_rev2std_12289($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $20 = sp;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $16 = 1; //@line 92 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = $9; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 $10 = $21; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $22 = $10; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = ($22>>>0)>(2); //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($23)) {
   break;
  }
  $14 = 0; //@line 97 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = $10; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $24 >>> 1; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = $25; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = 0; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $26 = $12; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $27 = $11; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $28 = ($26>>>0)<($27>>>0); //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($28)) {
    break;
   }
   $29 = $14; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $30 = $16; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $31 = (($29) + ($30))|0; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $32 = (($31) - 1)|0; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $15 = $32; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $33 = $11; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $34 = $12; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $35 = (($33) + ($34))|0; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $36 = $6; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $37 = (($36) + ($35<<2)|0); //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $38 = HEAP32[$37>>2]|0; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $17 = $38; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $39 = $14; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   $13 = $39; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $40 = $13; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $41 = $15; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $42 = ($40>>>0)<=($41>>>0); //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($42)) {
     break;
    }
    $43 = $13; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $44 = $5; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $45 = (($44) + ($43<<2)|0); //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $46 = HEAP32[$45>>2]|0; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $18 = $46; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $47 = $13; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $48 = $16; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $49 = (($47) + ($48))|0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $50 = $5; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $51 = (($50) + ($49<<2)|0); //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $52 = HEAP32[$51>>2]|0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $19 = $52; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $53 = $18; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $54 = $19; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $55 = (($53) + ($54))|0; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $56 = $13; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $57 = $5; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $58 = (($57) + ($56<<2)|0); //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$58>>2] = $55; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $59 = $18; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $60 = $19; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $61 = (($59) - ($60))|0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $62 = ($61|0)<(0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $63 = $62 << 31 >> 31; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $64 = $17; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $65 = ($64|0)<(0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $66 = $65 << 31 >> 31; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $67 = (___muldi3(($61|0),($63|0),($64|0),($66|0))|0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $68 = tempRet0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $69 = $20; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $70 = $69; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$70>>2] = $67; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $71 = (($69) + 4)|0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $72 = $71; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$72>>2] = $68; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $73 = $10; //@line 107 "LatticeCrypto_v1.0/generic/ntt.c"
    $74 = ($73|0)==(32); //@line 107 "LatticeCrypto_v1.0/generic/ntt.c"
    if ($74) {
     $75 = $13; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $76 = $5; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $77 = (($76) + ($75<<2)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $78 = HEAP32[$77>>2]|0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $79 = ($78|0)<(0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $80 = $79 << 31 >> 31; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $81 = (_reduce12289($78,$80)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $82 = $13; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $83 = $5; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $84 = (($83) + ($82<<2)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$84>>2] = $81; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $85 = $20; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $86 = $85; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $87 = HEAP32[$86>>2]|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $88 = (($85) + 4)|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $89 = $88; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $90 = HEAP32[$89>>2]|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $91 = (_reduce12289_2x($87,$90)|0); //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $92 = $13; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $93 = $16; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $94 = (($92) + ($93))|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $95 = $5; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $96 = (($95) + ($94<<2)|0); //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$96>>2] = $91; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
    } else {
     $97 = $20; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $98 = $97; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $99 = HEAP32[$98>>2]|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $100 = (($97) + 4)|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $101 = $100; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $102 = HEAP32[$101>>2]|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $103 = (_reduce12289($99,$102)|0); //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $104 = $13; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $105 = $16; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $106 = (($104) + ($105))|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $107 = $5; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $108 = (($107) + ($106<<2)|0); //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$108>>2] = $103; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
    }
    $109 = $13; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $110 = (($109) + 1)|0; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $13 = $110; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $111 = $14; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $112 = $16; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $113 = $112<<1; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $114 = (($111) + ($113))|0; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $14 = $114; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $115 = $12; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $116 = (($115) + 1)|0; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = $116; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $117 = $16; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $118 = $117<<1; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $118; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $119 = $10; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $120 = $119 >>> 1; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $120; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $13 = 0; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $121 = $13; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $122 = $16; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $123 = ($121>>>0)<($122>>>0); //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($123)) {
   break;
  }
  $124 = $13; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $125 = $5; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $126 = (($125) + ($124<<2)|0); //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $127 = HEAP32[$126>>2]|0; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = $127; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $128 = $13; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $129 = $16; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $130 = (($128) + ($129))|0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $131 = $5; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $132 = (($131) + ($130<<2)|0); //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $133 = HEAP32[$132>>2]|0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $133; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $134 = $18; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $135 = $19; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $136 = (($134) + ($135))|0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $137 = ($136|0)<(0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $138 = $137 << 31 >> 31; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $139 = $8; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $140 = ($139|0)<(0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $141 = $140 << 31 >> 31; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $142 = (___muldi3(($136|0),($138|0),($139|0),($141|0))|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $143 = tempRet0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $144 = (_reduce12289($142,$143)|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $145 = $13; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $146 = $5; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $147 = (($146) + ($145<<2)|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$147>>2] = $144; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $148 = $18; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $149 = $19; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $150 = (($148) - ($149))|0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $151 = ($150|0)<(0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $152 = $151 << 31 >> 31; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $153 = $7; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $154 = ($153|0)<(0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $155 = $154 << 31 >> 31; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $156 = (___muldi3(($150|0),($152|0),($153|0),($155|0))|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $157 = tempRet0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $158 = (_reduce12289($156,$157)|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $159 = $13; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $160 = $16; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $161 = (($159) + ($160))|0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $162 = $5; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $163 = (($162) + ($161<<2)|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$163>>2] = $158; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $164 = $13; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $165 = (($164) + 1)|0; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $165; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 124 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _two_reduce12289($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = 0; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $5 = $4; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $3; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = ($5>>>0)<($6>>>0); //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($7)) {
   break;
  }
  $8 = $4; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $2; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = (($9) + ($8<<2)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = HEAP32[$10>>2]|0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = ($11|0)<(0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $12 << 31 >> 31; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = (_reduce12289($11,$13)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $4; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $2; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = (($16) + ($15<<2)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$17>>2] = $14; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = $4; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $2; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (($19) + ($18<<2)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = HEAP32[$20>>2]|0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = ($21|0)<(0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $22 << 31 >> 31; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (_reduce12289($21,$23)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $4; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = $2; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = (($26) + ($25<<2)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$27>>2] = $24; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = $4; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = (($28) + 1)|0; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = $29; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 136 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _pmul($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = 0; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $9 = $8; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $7; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = ($9>>>0)<($10>>>0); //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($11)) {
   break;
  }
  $12 = $8; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $4; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = (($13) + ($12<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = HEAP32[$14>>2]|0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = ($15|0)<(0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = $16 << 31 >> 31; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = $8; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $5; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (($19) + ($18<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = HEAP32[$20>>2]|0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = ($21|0)<(0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $22 << 31 >> 31; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (___muldi3(($15|0),($17|0),($21|0),($23|0))|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = tempRet0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = (_reduce12289($24,$25)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = $8; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = $6; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = (($28) + ($27<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$29>>2] = $26; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = $8; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = $6; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = (($31) + ($30<<2)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = HEAP32[$32>>2]|0; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = ($33|0)<(0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = $34 << 31 >> 31; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (_reduce12289($33,$35)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $37 = $8; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $38 = $6; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $39 = (($38) + ($37<<2)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$39>>2] = $36; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $40 = $8; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $41 = (($40) + 1)|0; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $41; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 147 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _pmuladd($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $10 = 0; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $11 = $10; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $9; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = ($11>>>0)<($12>>>0); //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($13)) {
   break;
  }
  $14 = $10; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $5; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = (($15) + ($14<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = HEAP32[$16>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = ($17|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $18 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = $10; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = $6; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = (($21) + ($20<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = HEAP32[$22>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = ($23|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $24 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = (___muldi3(($17|0),($19|0),($23|0),($25|0))|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = tempRet0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = $10; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = $7; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = (($29) + ($28<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = HEAP32[$30>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = ($31|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = $32 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = (_i64Add(($26|0),($27|0),($31|0),($33|0))|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = tempRet0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (_reduce12289($34,$35)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $37 = $10; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $38 = $8; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $39 = (($38) + ($37<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$39>>2] = $36; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $40 = $10; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $41 = $8; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $42 = (($41) + ($40<<2)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $43 = HEAP32[$42>>2]|0; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $44 = ($43|0)<(0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $45 = $44 << 31 >> 31; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $46 = (_reduce12289($43,$45)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $47 = $10; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $48 = $8; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $49 = (($48) + ($47<<2)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$49>>2] = $46; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $50 = $10; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $51 = (($50) + 1)|0; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $51; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 158 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _smul($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $7 = $6; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $5; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = ($7>>>0)<($8>>>0); //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($9)) {
   break;
  }
  $10 = $6; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = $3; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = (($11) + ($10<<2)|0); //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = HEAP32[$12>>2]|0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $4; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = Math_imul($13, $14)|0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $6; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = $3; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = (($17) + ($16<<2)|0); //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$18>>2] = $15; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $6; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (($19) + 1)|0; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $20; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 168 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _correction($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $8 = $6; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $5; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = ($8>>>0)<($9>>>0); //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($10)) {
   break;
  }
  $11 = $6; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $3; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = (($12) + ($11<<2)|0); //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = HEAP32[$13>>2]|0; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $14 >> 15; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $15; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $4; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = $7; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = $16 & $17; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $4; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (($18) - ($19))|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = $6; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $3; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = (($22) + ($21<<2)|0); //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = HEAP32[$23>>2]|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = (($24) + ($20))|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$23>>2] = $25; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = $6; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = $3; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = (($27) + ($26<<2)|0); //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = HEAP32[$28>>2]|0; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = $29 >> 15; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $30; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = $4; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = $7; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = $31 & $32; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = $6; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = $3; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (($35) + ($34<<2)|0); //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $37 = HEAP32[$36>>2]|0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $38 = (($37) + ($33))|0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$36>>2] = $38; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $39 = $6; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $40 = (($39) + 1)|0; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $40; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 182 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _clear_words($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $6 = $2; //@line 32 "LatticeCrypto_v1.0/kex.c"
 $5 = $6; //@line 32 "LatticeCrypto_v1.0/kex.c"
 $4 = 0; //@line 34 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $7 = $4; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $8 = $3; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $9 = ($7>>>0)<($8>>>0); //@line 34 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $4; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $11 = $5; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10<<2)|0); //@line 35 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$12>>2] = 0; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $13 = $4; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $14 = (($13) + 1)|0; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $4 = $14; //@line 34 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 37 "LatticeCrypto_v1.0/kex.c"
}
function _LatticeCrypto_initialize($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = $5; //@line 43 "LatticeCrypto_v1.0/kex.c"
 $9 = $4; //@line 43 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$9>>2] = $8; //@line 43 "LatticeCrypto_v1.0/kex.c"
 $10 = $6; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $11 = $4; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $12 = ((($11)) + 4|0); //@line 44 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$12>>2] = $10; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $13 = $7; //@line 45 "LatticeCrypto_v1.0/kex.c"
 $14 = $4; //@line 45 "LatticeCrypto_v1.0/kex.c"
 $15 = ((($14)) + 8|0); //@line 45 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$15>>2] = $13; //@line 45 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return 0; //@line 47 "LatticeCrypto_v1.0/kex.c"
}
function _LatticeCrypto_allocate() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = 0; //@line 54 "LatticeCrypto_v1.0/kex.c"
 $2 = (_calloc(1,12)|0); //@line 56 "LatticeCrypto_v1.0/kex.c"
 $1 = $2; //@line 56 "LatticeCrypto_v1.0/kex.c"
 $3 = $1; //@line 58 "LatticeCrypto_v1.0/kex.c"
 $4 = ($3|0)==(0|0); //@line 58 "LatticeCrypto_v1.0/kex.c"
 if ($4) {
  $0 = 0; //@line 59 "LatticeCrypto_v1.0/kex.c"
 } else {
  $5 = $1; //@line 61 "LatticeCrypto_v1.0/kex.c"
  $0 = $5; //@line 61 "LatticeCrypto_v1.0/kex.c"
 }
 $6 = $0; //@line 62 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($6|0); //@line 62 "LatticeCrypto_v1.0/kex.c"
}
function _encode_A($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 92 "LatticeCrypto_v1.0/kex.c"
 $7 = 0; //@line 95 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $8 = $7; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $9 = ($8>>>0)<(1024); //@line 95 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $7; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $11 = $3; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10<<2)|0); //@line 96 "LatticeCrypto_v1.0/kex.c"
  $13 = HEAP32[$12>>2]|0; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $14 = $13 & 255; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $15 = $14&255; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $16 = $6; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $17 = $5; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $18 = (($17) + ($16)|0); //@line 96 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$18>>0] = $15; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $19 = $7; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $20 = $3; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $21 = (($20) + ($19<<2)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  $22 = HEAP32[$21>>2]|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $23 = $22 >>> 8; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $24 = $7; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + 1)|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $26 = $3; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $27 = (($26) + ($25<<2)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  $28 = HEAP32[$27>>2]|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $29 = $28 & 3; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $30 = $29 << 6; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $31 = $23 | $30; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $32 = $31&255; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $33 = $6; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $34 = (($33) + 1)|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $35 = $5; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $36 = (($35) + ($34)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$36>>0] = $32; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $37 = $7; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + 1)|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $39 = $3; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + ($38<<2)|0); //@line 98 "LatticeCrypto_v1.0/kex.c"
  $41 = HEAP32[$40>>2]|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $42 = $41 >>> 2; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 & 255; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $44 = $43&255; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $45 = $6; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $46 = (($45) + 2)|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $47 = $5; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $48 = (($47) + ($46)|0); //@line 98 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$48>>0] = $44; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $49 = $7; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $50 = (($49) + 1)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $51 = $3; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + ($50<<2)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  $53 = HEAP32[$52>>2]|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $54 = $53 >>> 10; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $55 = $7; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $56 = (($55) + 2)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $57 = $3; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + ($56<<2)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  $59 = HEAP32[$58>>2]|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $60 = $59 & 15; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $61 = $60 << 4; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $62 = $54 | $61; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $63 = $62&255; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $64 = $6; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + 3)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $66 = $5; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $67 = (($66) + ($65)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$67>>0] = $63; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $68 = $7; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $69 = (($68) + 2)|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $70 = $3; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $71 = (($70) + ($69<<2)|0); //@line 100 "LatticeCrypto_v1.0/kex.c"
  $72 = HEAP32[$71>>2]|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $73 = $72 >>> 4; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $74 = $73 & 255; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $75 = $74&255; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $76 = $6; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + 4)|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $78 = $5; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + ($77)|0); //@line 100 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$79>>0] = $75; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $80 = $7; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + 2)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $82 = $3; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $83 = (($82) + ($81<<2)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  $84 = HEAP32[$83>>2]|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $85 = $84 >>> 12; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $86 = $7; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $87 = (($86) + 3)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $88 = $3; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $89 = (($88) + ($87<<2)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  $90 = HEAP32[$89>>2]|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $91 = $90 & 63; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $92 = $91 << 2; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $93 = $85 | $92; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $94 = $93&255; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $95 = $6; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + 5)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $97 = $5; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + ($96)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$98>>0] = $94; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $99 = $7; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + 3)|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $101 = $3; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $102 = (($101) + ($100<<2)|0); //@line 102 "LatticeCrypto_v1.0/kex.c"
  $103 = HEAP32[$102>>2]|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $104 = $103 >>> 6; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $105 = $104&255; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $106 = $6; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $107 = (($106) + 6)|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $108 = $5; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $109 = (($108) + ($107)|0); //@line 102 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$109>>0] = $105; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $110 = $6; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + 7)|0; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $6 = $111; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $112 = $7; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + 4)|0; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $7 = $113; //@line 95 "LatticeCrypto_v1.0/kex.c"
 }
 $7 = 0; //@line 111 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $114 = $7; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $115 = ($114>>>0)<(32); //@line 111 "LatticeCrypto_v1.0/kex.c"
  if (!($115)) {
   break;
  }
  $116 = $7; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $117 = $4; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $118 = (($117) + ($116)|0); //@line 112 "LatticeCrypto_v1.0/kex.c"
  $119 = HEAP8[$118>>0]|0; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $120 = $6; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $121 = $7; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $122 = (($120) + ($121))|0; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $123 = $5; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $124 = (($123) + ($122)|0); //@line 112 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$124>>0] = $119; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $125 = $7; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $126 = (($125) + 1)|0; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $7 = $126; //@line 111 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 114 "LatticeCrypto_v1.0/kex.c"
}
function _decode_A($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 119 "LatticeCrypto_v1.0/kex.c"
 $7 = 0; //@line 122 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $8 = $7; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $9 = ($8>>>0)<(1024); //@line 122 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $6; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $11 = $3; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  $13 = HEAP8[$12>>0]|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $14 = $13&255; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $15 = $6; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $16 = (($15) + 1)|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $17 = $3; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $18 = (($17) + ($16)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  $19 = HEAP8[$18>>0]|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $20 = $19&255; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $21 = $20 & 63; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $22 = $21 << 8; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $23 = $14 | $22; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $24 = $7; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $25 = $4; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $26 = (($25) + ($24<<2)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$26>>2] = $23; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $27 = $6; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $28 = (($27) + 1)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $29 = $3; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + ($28)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $31 = HEAP8[$30>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $32 = $31&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $33 = $32 >>> 6; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $34 = $6; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $35 = (($34) + 2)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $36 = $3; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $37 = (($36) + ($35)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $38 = HEAP8[$37>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $39 = $38&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $40 = $39 << 2; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $41 = $33 | $40; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $42 = $6; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + 3)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $44 = $3; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + ($43)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $46 = HEAP8[$45>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $47 = $46&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $48 = $47 & 15; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $49 = $48 << 10; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $50 = $41 | $49; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $51 = $7; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + 1)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $53 = $4; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $54 = (($53) + ($52<<2)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$54>>2] = $50; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $55 = $6; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $56 = (($55) + 3)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $57 = $3; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + ($56)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $59 = HEAP8[$58>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $60 = $59&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $61 = $60 >>> 4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $62 = $6; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $63 = (($62) + 4)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $64 = $3; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + ($63)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $66 = HEAP8[$65>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $67 = $66&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $68 = $67 << 4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $69 = $61 | $68; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $70 = $6; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $71 = (($70) + 5)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $72 = $3; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $73 = (($72) + ($71)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $74 = HEAP8[$73>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $75 = $74&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $76 = $75 & 3; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $77 = $76 << 12; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $78 = $69 | $77; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $79 = $7; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $80 = (($79) + 2)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $81 = $4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $82 = (($81) + ($80<<2)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$82>>2] = $78; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $83 = $6; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + 5)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $85 = $3; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + ($84)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  $87 = HEAP8[$86>>0]|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $88 = $87&255; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $89 = $88 >>> 2; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $90 = $6; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $91 = (($90) + 6)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $92 = $3; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $93 = (($92) + ($91)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  $94 = HEAP8[$93>>0]|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $95 = $94&255; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $96 = $95 << 6; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $97 = $89 | $96; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $98 = $7; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $99 = (($98) + 3)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $100 = $4; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $101 = (($100) + ($99<<2)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$101>>2] = $97; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $102 = $6; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $103 = (($102) + 7)|0; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $6 = $103; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $104 = $7; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $105 = (($104) + 4)|0; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $7 = $105; //@line 122 "LatticeCrypto_v1.0/kex.c"
 }
 $7 = 0; //@line 135 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $106 = $7; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $107 = ($106>>>0)<(32); //@line 135 "LatticeCrypto_v1.0/kex.c"
  if (!($107)) {
   break;
  }
  $108 = $6; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $109 = $7; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $110 = (($108) + ($109))|0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $111 = $3; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $112 = (($111) + ($110)|0); //@line 136 "LatticeCrypto_v1.0/kex.c"
  $113 = HEAP8[$112>>0]|0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $114 = $7; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $115 = $5; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $116 = (($115) + ($114)|0); //@line 136 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$116>>0] = $113; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $117 = $7; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $118 = (($117) + 1)|0; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $7 = $118; //@line 135 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 138 "LatticeCrypto_v1.0/kex.c"
}
function _encode_B($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 143 "LatticeCrypto_v1.0/kex.c"
 $7 = 0; //@line 146 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $8 = $7; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $9 = ($8>>>0)<(1024); //@line 146 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $7; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $11 = $3; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10<<2)|0); //@line 147 "LatticeCrypto_v1.0/kex.c"
  $13 = HEAP32[$12>>2]|0; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $14 = $13 & 255; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $15 = $14&255; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $16 = $6; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $17 = $5; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $18 = (($17) + ($16)|0); //@line 147 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$18>>0] = $15; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $19 = $7; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $20 = $3; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $21 = (($20) + ($19<<2)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  $22 = HEAP32[$21>>2]|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $23 = $22 >>> 8; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $24 = $7; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + 1)|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $26 = $3; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $27 = (($26) + ($25<<2)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  $28 = HEAP32[$27>>2]|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $29 = $28 & 3; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $30 = $29 << 6; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $31 = $23 | $30; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $32 = $31&255; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $33 = $6; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $34 = (($33) + 1)|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $35 = $5; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $36 = (($35) + ($34)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$36>>0] = $32; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $37 = $7; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + 1)|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $39 = $3; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + ($38<<2)|0); //@line 149 "LatticeCrypto_v1.0/kex.c"
  $41 = HEAP32[$40>>2]|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $42 = $41 >>> 2; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 & 255; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $44 = $43&255; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $45 = $6; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $46 = (($45) + 2)|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $47 = $5; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $48 = (($47) + ($46)|0); //@line 149 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$48>>0] = $44; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $49 = $7; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $50 = (($49) + 1)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $51 = $3; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + ($50<<2)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  $53 = HEAP32[$52>>2]|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $54 = $53 >>> 10; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $55 = $7; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $56 = (($55) + 2)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $57 = $3; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + ($56<<2)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  $59 = HEAP32[$58>>2]|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $60 = $59 & 15; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $61 = $60 << 4; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $62 = $54 | $61; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $63 = $62&255; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $64 = $6; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + 3)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $66 = $5; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $67 = (($66) + ($65)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$67>>0] = $63; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $68 = $7; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $69 = (($68) + 2)|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $70 = $3; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $71 = (($70) + ($69<<2)|0); //@line 151 "LatticeCrypto_v1.0/kex.c"
  $72 = HEAP32[$71>>2]|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $73 = $72 >>> 4; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $74 = $73 & 255; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $75 = $74&255; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $76 = $6; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + 4)|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $78 = $5; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + ($77)|0); //@line 151 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$79>>0] = $75; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $80 = $7; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + 2)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $82 = $3; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $83 = (($82) + ($81<<2)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  $84 = HEAP32[$83>>2]|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $85 = $84 >>> 12; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $86 = $7; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $87 = (($86) + 3)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $88 = $3; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $89 = (($88) + ($87<<2)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  $90 = HEAP32[$89>>2]|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $91 = $90 & 63; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $92 = $91 << 2; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $93 = $85 | $92; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $94 = $93&255; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $95 = $6; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + 5)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $97 = $5; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + ($96)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$98>>0] = $94; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $99 = $7; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + 3)|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $101 = $3; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $102 = (($101) + ($100<<2)|0); //@line 153 "LatticeCrypto_v1.0/kex.c"
  $103 = HEAP32[$102>>2]|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $104 = $103 >>> 6; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $105 = $104&255; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $106 = $6; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $107 = (($106) + 6)|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $108 = $5; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $109 = (($108) + ($107)|0); //@line 153 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$109>>0] = $105; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $110 = $6; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + 7)|0; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $6 = $111; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $112 = $7; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + 4)|0; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $7 = $113; //@line 146 "LatticeCrypto_v1.0/kex.c"
 }
 $6 = 0; //@line 161 "LatticeCrypto_v1.0/kex.c"
 $7 = 0; //@line 162 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $114 = $7; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $115 = ($114>>>0)<(256); //@line 162 "LatticeCrypto_v1.0/kex.c"
  if (!($115)) {
   break;
  }
  $116 = $6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $117 = $4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $118 = (($117) + ($116<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $119 = HEAP32[$118>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $120 = $6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $121 = (($120) + 1)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $122 = $4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $123 = (($122) + ($121<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $124 = HEAP32[$123>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $125 = $124 << 2; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $126 = $119 | $125; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $127 = $6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $128 = (($127) + 2)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $129 = $4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $130 = (($129) + ($128<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $131 = HEAP32[$130>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $132 = $131 << 4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $133 = $126 | $132; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $134 = $6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $135 = (($134) + 3)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $136 = $4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $137 = (($136) + ($135<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $138 = HEAP32[$137>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $139 = $138 << 6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $140 = $133 | $139; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $141 = $140&255; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $142 = $7; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $143 = (1792 + ($142))|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $144 = $5; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $145 = (($144) + ($143)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$145>>0] = $141; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $146 = $6; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $147 = (($146) + 4)|0; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $6 = $147; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $148 = $7; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $149 = (($148) + 1)|0; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $7 = $149; //@line 162 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 166 "LatticeCrypto_v1.0/kex.c"
}
function _decode_B($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 171 "LatticeCrypto_v1.0/kex.c"
 $7 = 0; //@line 174 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $8 = $7; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $9 = ($8>>>0)<(1024); //@line 174 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $6; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $11 = $3; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  $13 = HEAP8[$12>>0]|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $14 = $13&255; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $15 = $6; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $16 = (($15) + 1)|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $17 = $3; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $18 = (($17) + ($16)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  $19 = HEAP8[$18>>0]|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $20 = $19&255; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $21 = $20 & 63; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $22 = $21 << 8; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $23 = $14 | $22; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $24 = $7; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $25 = $4; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $26 = (($25) + ($24<<2)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$26>>2] = $23; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $27 = $6; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $28 = (($27) + 1)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $29 = $3; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + ($28)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $31 = HEAP8[$30>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $32 = $31&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $33 = $32 >>> 6; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $34 = $6; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $35 = (($34) + 2)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $36 = $3; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $37 = (($36) + ($35)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $38 = HEAP8[$37>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $39 = $38&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $40 = $39 << 2; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $41 = $33 | $40; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $42 = $6; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + 3)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $44 = $3; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + ($43)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $46 = HEAP8[$45>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $47 = $46&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $48 = $47 & 15; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $49 = $48 << 10; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $50 = $41 | $49; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $51 = $7; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + 1)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $53 = $4; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $54 = (($53) + ($52<<2)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$54>>2] = $50; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $55 = $6; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $56 = (($55) + 3)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $57 = $3; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + ($56)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $59 = HEAP8[$58>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $60 = $59&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $61 = $60 >>> 4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $62 = $6; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $63 = (($62) + 4)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $64 = $3; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + ($63)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $66 = HEAP8[$65>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $67 = $66&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $68 = $67 << 4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $69 = $61 | $68; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $70 = $6; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $71 = (($70) + 5)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $72 = $3; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $73 = (($72) + ($71)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $74 = HEAP8[$73>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $75 = $74&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $76 = $75 & 3; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $77 = $76 << 12; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $78 = $69 | $77; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $79 = $7; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $80 = (($79) + 2)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $81 = $4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $82 = (($81) + ($80<<2)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$82>>2] = $78; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $83 = $6; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + 5)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $85 = $3; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + ($84)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  $87 = HEAP8[$86>>0]|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $88 = $87&255; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $89 = $88 >>> 2; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $90 = $6; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $91 = (($90) + 6)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $92 = $3; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $93 = (($92) + ($91)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  $94 = HEAP8[$93>>0]|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $95 = $94&255; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $96 = $95 << 6; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $97 = $89 | $96; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $98 = $7; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $99 = (($98) + 3)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $100 = $4; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $101 = (($100) + ($99<<2)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$101>>2] = $97; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $102 = $6; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $103 = (($102) + 7)|0; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $6 = $103; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $104 = $7; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $105 = (($104) + 4)|0; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $7 = $105; //@line 174 "LatticeCrypto_v1.0/kex.c"
 }
 $6 = 0; //@line 187 "LatticeCrypto_v1.0/kex.c"
 $7 = 0; //@line 188 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $106 = $7; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $107 = ($106>>>0)<(256); //@line 188 "LatticeCrypto_v1.0/kex.c"
  if (!($107)) {
   break;
  }
  $108 = $7; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $109 = (1792 + ($108))|0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $110 = $3; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + ($109)|0); //@line 189 "LatticeCrypto_v1.0/kex.c"
  $112 = HEAP8[$111>>0]|0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $113 = $112&255; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $114 = $113 & 3; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $115 = $6; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $116 = $5; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $117 = (($116) + ($115<<2)|0); //@line 189 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$117>>2] = $114; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $118 = $7; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $119 = (1792 + ($118))|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $120 = $3; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $121 = (($120) + ($119)|0); //@line 190 "LatticeCrypto_v1.0/kex.c"
  $122 = HEAP8[$121>>0]|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $123 = $122&255; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $124 = $123 >> 2; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $125 = $124 & 3; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $126 = $6; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $127 = (($126) + 1)|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $128 = $5; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $129 = (($128) + ($127<<2)|0); //@line 190 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$129>>2] = $125; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $130 = $7; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $131 = (1792 + ($130))|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $132 = $3; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $133 = (($132) + ($131)|0); //@line 191 "LatticeCrypto_v1.0/kex.c"
  $134 = HEAP8[$133>>0]|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $135 = $134&255; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $136 = $135 >> 4; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $137 = $136 & 3; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $138 = $6; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $139 = (($138) + 2)|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $140 = $5; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $141 = (($140) + ($139<<2)|0); //@line 191 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$141>>2] = $137; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $142 = $7; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $143 = (1792 + ($142))|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $144 = $3; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $145 = (($144) + ($143)|0); //@line 192 "LatticeCrypto_v1.0/kex.c"
  $146 = HEAP8[$145>>0]|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $147 = $146&255; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $148 = $147 >> 6; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $149 = $6; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $150 = (($149) + 3)|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $151 = $5; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $152 = (($151) + ($150<<2)|0); //@line 192 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$152>>2] = $148; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $153 = $6; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $154 = (($153) + 4)|0; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $6 = $154; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $155 = $7; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $156 = (($155) + 1)|0; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $7 = $156; //@line 188 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 195 "LatticeCrypto_v1.0/kex.c"
}
function _HelpRec($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $15 = sp + 88|0;
 $16 = sp + 80|0;
 $17 = sp + 24|0;
 $18 = sp + 8|0;
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 ;HEAP8[$16>>0]=0|0;HEAP8[$16+1>>0]=0|0;HEAP8[$16+2>>0]=0|0;HEAP8[$16+3>>0]=0|0;HEAP8[$16+4>>0]=0|0;HEAP8[$16+5>>0]=0|0;HEAP8[$16+6>>0]=0|0;HEAP8[$16+7>>0]=0|0; //@line 210 "LatticeCrypto_v1.0/kex.c"
 $19 = 3; //@line 212 "LatticeCrypto_v1.0/kex.c"
 $20 = $9; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $21 = $20&255; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $22 = ((($16)) + 1|0); //@line 214 "LatticeCrypto_v1.0/kex.c"
 HEAP8[$22>>0] = $21; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $23 = $8; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $24 = $10; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $25 = (_stream_output($23,32,$16,32,32,$15,$24)|0); //@line 215 "LatticeCrypto_v1.0/kex.c"
 $19 = $25; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $26 = $19; //@line 216 "LatticeCrypto_v1.0/kex.c"
 $27 = ($26|0)!=(0); //@line 216 "LatticeCrypto_v1.0/kex.c"
 if ($27) {
  _clear_words($15,8); //@line 217 "LatticeCrypto_v1.0/kex.c"
  $28 = $19; //@line 218 "LatticeCrypto_v1.0/kex.c"
  $5 = $28; //@line 218 "LatticeCrypto_v1.0/kex.c"
  $294 = $5; //@line 259 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($294|0); //@line 259 "LatticeCrypto_v1.0/kex.c"
 }
 $11 = 0; //@line 225 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $29 = $11; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $30 = ($29>>>0)<(256); //@line 225 "LatticeCrypto_v1.0/kex.c"
  if (!($30)) {
   break;
  }
  $31 = $11; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $32 = $31 >>> 3; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $33 = (($15) + ($32)|0); //@line 226 "LatticeCrypto_v1.0/kex.c"
  $34 = HEAP8[$33>>0]|0; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $35 = $34&255; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $36 = $11; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $37 = $36 & 7; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $38 = $35 >> $37; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $39 = 1 & $38; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $40 = $39&255; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $14 = $40; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $41 = $11; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $42 = $6; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + ($41<<2)|0); //@line 227 "LatticeCrypto_v1.0/kex.c"
  $44 = HEAP32[$43>>2]|0; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $45 = $44 << 1; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $46 = $14; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $47 = $46&255; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $48 = (($45) - ($47))|0; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $49 = $11; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $50 = $7; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + ($49<<2)|0); //@line 227 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$51>>2] = $48; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $52 = $11; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + 256)|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $54 = $6; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $55 = (($54) + ($53<<2)|0); //@line 228 "LatticeCrypto_v1.0/kex.c"
  $56 = HEAP32[$55>>2]|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $57 = $56 << 1; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $58 = $14; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $59 = $58&255; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $60 = (($57) - ($59))|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $61 = $11; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $62 = (($61) + 256)|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $63 = $7; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + ($62<<2)|0); //@line 228 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$64>>2] = $60; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $65 = $11; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + 512)|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $67 = $6; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $68 = (($67) + ($66<<2)|0); //@line 229 "LatticeCrypto_v1.0/kex.c"
  $69 = HEAP32[$68>>2]|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $70 = $69 << 1; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $71 = $14; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $72 = $71&255; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $73 = (($70) - ($72))|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $74 = $11; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + 512)|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $76 = $7; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + ($75<<2)|0); //@line 229 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = $73; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $78 = $11; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 768)|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $80 = $6; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79<<2)|0); //@line 230 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP32[$81>>2]|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $83 = $82 << 1; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $84 = $14; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $85 = $84&255; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $86 = (($83) - ($85))|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $87 = $11; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $88 = (($87) + 768)|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $89 = $7; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $90 = (($89) + ($88<<2)|0); //@line 230 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$90>>2] = $86; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $13 = 0; //@line 232 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$17>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $91 = ((($17)) + 4|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$91>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $92 = ((($17)) + 8|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$92>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $93 = ((($17)) + 12|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$93>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$18>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $94 = ((($18)) + 4|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$94>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $95 = ((($18)) + 8|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$95>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $96 = ((($18)) + 12|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $12 = 0; //@line 235 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $97 = $12; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $98 = ($97>>>0)<(4); //@line 235 "LatticeCrypto_v1.0/kex.c"
   if (!($98)) {
    break;
   }
   $99 = $11; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $100 = $12; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $101 = $100<<8; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $102 = (($99) + ($101))|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $103 = $7; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $104 = (($103) + ($102<<2)|0); //@line 236 "LatticeCrypto_v1.0/kex.c"
   $105 = HEAP32[$104>>2]|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $106 = (($105) - 3073)|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $107 = $106 >>> 31; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $108 = $12; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $109 = (($17) + ($108<<2)|0); //@line 236 "LatticeCrypto_v1.0/kex.c"
   $110 = HEAP32[$109>>2]|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $111 = (($110) - ($107))|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$109>>2] = $111; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $112 = $11; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $113 = $12; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $114 = $113<<8; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $115 = (($112) + ($114))|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $116 = $7; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $117 = (($116) + ($115<<2)|0); //@line 237 "LatticeCrypto_v1.0/kex.c"
   $118 = HEAP32[$117>>2]|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $119 = (($118) - 9217)|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $120 = $119 >>> 31; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $121 = $12; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $122 = (($17) + ($121<<2)|0); //@line 237 "LatticeCrypto_v1.0/kex.c"
   $123 = HEAP32[$122>>2]|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $124 = (($123) - ($120))|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$122>>2] = $124; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $125 = $11; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $126 = $12; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $127 = $126<<8; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $128 = (($125) + ($127))|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $129 = $7; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $130 = (($129) + ($128<<2)|0); //@line 238 "LatticeCrypto_v1.0/kex.c"
   $131 = HEAP32[$130>>2]|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $132 = (($131) - 15362)|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $133 = $132 >>> 31; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $134 = $12; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $135 = (($17) + ($134<<2)|0); //@line 238 "LatticeCrypto_v1.0/kex.c"
   $136 = HEAP32[$135>>2]|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $137 = (($136) - ($133))|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$135>>2] = $137; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $138 = $11; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $139 = $12; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $140 = $139<<8; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $141 = (($138) + ($140))|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $142 = $7; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $143 = (($142) + ($141<<2)|0); //@line 239 "LatticeCrypto_v1.0/kex.c"
   $144 = HEAP32[$143>>2]|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $145 = (($144) - 21506)|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $146 = $145 >>> 31; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $147 = $12; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $148 = (($17) + ($147<<2)|0); //@line 239 "LatticeCrypto_v1.0/kex.c"
   $149 = HEAP32[$148>>2]|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $150 = (($149) - ($146))|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$148>>2] = $150; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $151 = $11; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $152 = $12; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $153 = $152<<8; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $154 = (($151) + ($153))|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $155 = $7; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $156 = (($155) + ($154<<2)|0); //@line 240 "LatticeCrypto_v1.0/kex.c"
   $157 = HEAP32[$156>>2]|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $158 = (($157) - 6145)|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $159 = $158 >>> 31; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $160 = $12; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $161 = (($18) + ($160<<2)|0); //@line 240 "LatticeCrypto_v1.0/kex.c"
   $162 = HEAP32[$161>>2]|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $163 = (($162) - ($159))|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$161>>2] = $163; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $164 = $11; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $165 = $12; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $166 = $165<<8; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $167 = (($164) + ($166))|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $168 = $7; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $169 = (($168) + ($167<<2)|0); //@line 241 "LatticeCrypto_v1.0/kex.c"
   $170 = HEAP32[$169>>2]|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $171 = (($170) - 12289)|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $172 = $171 >>> 31; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $173 = $12; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $174 = (($18) + ($173<<2)|0); //@line 241 "LatticeCrypto_v1.0/kex.c"
   $175 = HEAP32[$174>>2]|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $176 = (($175) - ($172))|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$174>>2] = $176; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $177 = $11; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $178 = $12; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $179 = $178<<8; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $180 = (($177) + ($179))|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $181 = $7; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $182 = (($181) + ($180<<2)|0); //@line 242 "LatticeCrypto_v1.0/kex.c"
   $183 = HEAP32[$182>>2]|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $184 = (($183) - 18434)|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $185 = $184 >>> 31; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $186 = $12; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $187 = (($18) + ($186<<2)|0); //@line 242 "LatticeCrypto_v1.0/kex.c"
   $188 = HEAP32[$187>>2]|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $189 = (($188) - ($185))|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$187>>2] = $189; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $190 = $11; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $191 = $12; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $192 = $191<<8; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $193 = (($190) + ($192))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $194 = $7; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $195 = (($194) + ($193<<2)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $196 = HEAP32[$195>>2]|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $197 = $196<<1; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $198 = $12; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $199 = (($17) + ($198<<2)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $200 = HEAP32[$199>>2]|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $201 = ($200*12289)|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $202 = (($197) - ($201))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $203 = (_Abs($202)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $204 = $13; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $205 = (($204) + ($203))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $13 = $205; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $206 = $12; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $207 = (($206) + 1)|0; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $12 = $207; //@line 235 "LatticeCrypto_v1.0/kex.c"
  }
  $208 = $13; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $209 = (($208) - 12289)|0; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $210 = $209 >> 31; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $13 = $210; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $211 = $13; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $212 = HEAP32[$17>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $213 = HEAP32[$18>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $214 = $212 ^ $213; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $215 = $211 & $214; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $216 = HEAP32[$18>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $217 = $215 ^ $216; //@line 247 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$17>>2] = $217; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $218 = $13; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $219 = ((($17)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $220 = HEAP32[$219>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $221 = ((($18)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $222 = HEAP32[$221>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $223 = $220 ^ $222; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $224 = $218 & $223; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $225 = ((($18)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $226 = HEAP32[$225>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $227 = $224 ^ $226; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $228 = ((($17)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$228>>2] = $227; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $229 = $13; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $230 = ((($17)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $231 = HEAP32[$230>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $232 = ((($18)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $233 = HEAP32[$232>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $234 = $231 ^ $233; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $235 = $229 & $234; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $236 = ((($18)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $237 = HEAP32[$236>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $238 = $235 ^ $237; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $239 = ((($17)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$239>>2] = $238; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $240 = $13; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $241 = ((($17)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $242 = HEAP32[$241>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $243 = ((($18)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $244 = HEAP32[$243>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $245 = $242 ^ $244; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $246 = $240 & $245; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $247 = ((($18)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $248 = HEAP32[$247>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $249 = $246 ^ $248; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $250 = ((($17)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$250>>2] = $249; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $251 = HEAP32[$17>>2]|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $252 = ((($17)) + 12|0); //@line 251 "LatticeCrypto_v1.0/kex.c"
  $253 = HEAP32[$252>>2]|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $254 = (($251) - ($253))|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $255 = $254 & 3; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $256 = $11; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $257 = $7; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $258 = (($257) + ($256<<2)|0); //@line 251 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$258>>2] = $255; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $259 = ((($17)) + 4|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  $260 = HEAP32[$259>>2]|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $261 = ((($17)) + 12|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  $262 = HEAP32[$261>>2]|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $263 = (($260) - ($262))|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $264 = $263 & 3; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $265 = $11; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $266 = (($265) + 256)|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $267 = $7; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $268 = (($267) + ($266<<2)|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$268>>2] = $264; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $269 = ((($17)) + 8|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  $270 = HEAP32[$269>>2]|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $271 = ((($17)) + 12|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  $272 = HEAP32[$271>>2]|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $273 = (($270) - ($272))|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $274 = $273 & 3; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $275 = $11; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $276 = (($275) + 512)|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $277 = $7; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $278 = (($277) + ($276<<2)|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$278>>2] = $274; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $279 = ((($17)) + 12|0); //@line 254 "LatticeCrypto_v1.0/kex.c"
  $280 = HEAP32[$279>>2]|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $281 = $280 << 1; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $282 = $13; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $283 = $282 ^ -1; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $284 = 1 & $283; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $285 = (($281) + ($284))|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $286 = $285 & 3; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $287 = $11; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $288 = (($287) + 768)|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $289 = $7; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $290 = (($289) + ($288<<2)|0); //@line 254 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$290>>2] = $286; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $291 = $11; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $292 = (($291) + 1)|0; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $11 = $292; //@line 225 "LatticeCrypto_v1.0/kex.c"
 }
 $293 = $19; //@line 258 "LatticeCrypto_v1.0/kex.c"
 $5 = $293; //@line 258 "LatticeCrypto_v1.0/kex.c"
 $294 = $5; //@line 259 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($294|0); //@line 259 "LatticeCrypto_v1.0/kex.c"
}
function _Abs($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $3 = $1; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $4 = $3 >> 31; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $2 = $4; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $5 = $2; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $6 = $1; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $7 = $5 ^ $6; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $8 = $2; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $9 = (($7) - ($8))|0; //@line 203 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($9|0); //@line 203 "LatticeCrypto_v1.0/kex.c"
}
function _Rec($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $7 = sp;
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 287 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $8 = $6; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $9 = ($8>>>0)<(32); //@line 287 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $6; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $11 = $5; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10)|0); //@line 288 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$12>>0] = 0; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $13 = $6; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $14 = (($13) + 1)|0; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $6 = $14; //@line 287 "LatticeCrypto_v1.0/kex.c"
 }
 $6 = 0; //@line 290 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $15 = $6; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $16 = ($15>>>0)<(256); //@line 290 "LatticeCrypto_v1.0/kex.c"
  if (!($16)) {
   break;
  }
  $17 = $6; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $18 = $3; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $19 = (($18) + ($17<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $20 = HEAP32[$19>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $21 = $20<<3; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $22 = $6; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $23 = $4; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $24 = (($23) + ($22<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $25 = HEAP32[$24>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $26 = $25<<1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $27 = $6; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $28 = (($27) + 768)|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $29 = $4; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + ($28<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $31 = HEAP32[$30>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $32 = (($26) + ($31))|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $33 = ($32*12289)|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $34 = (($21) - ($33))|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$7>>2] = $34; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $35 = $6; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $36 = (($35) + 256)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $37 = $3; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + ($36<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $39 = HEAP32[$38>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $40 = $39<<3; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $41 = $6; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $42 = (($41) + 256)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $43 = $4; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $44 = (($43) + ($42<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $45 = HEAP32[$44>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $46 = $45<<1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $47 = $6; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $48 = (($47) + 768)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $49 = $4; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $50 = (($49) + ($48<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $51 = HEAP32[$50>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $52 = (($46) + ($51))|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $53 = ($52*12289)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $54 = (($40) - ($53))|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $55 = ((($7)) + 4|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$55>>2] = $54; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $56 = $6; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $57 = (($56) + 512)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $58 = $3; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $59 = (($58) + ($57<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $60 = HEAP32[$59>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $61 = $60<<3; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $62 = $6; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $63 = (($62) + 512)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $64 = $4; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + ($63<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $66 = HEAP32[$65>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $67 = $66<<1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $68 = $6; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $69 = (($68) + 768)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $70 = $4; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $71 = (($70) + ($69<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $72 = HEAP32[$71>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $73 = (($67) + ($72))|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $74 = ($73*12289)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $75 = (($61) - ($74))|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $76 = ((($7)) + 8|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$76>>2] = $75; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $77 = $6; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $78 = (($77) + 768)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $79 = $3; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $80 = (($79) + ($78<<2)|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  $81 = HEAP32[$80>>2]|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $82 = $81<<3; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $83 = $6; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + 768)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $85 = $4; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + ($84<<2)|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  $87 = HEAP32[$86>>2]|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $88 = ($87*12289)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $89 = (($82) - ($88))|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $90 = ((($7)) + 12|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$90>>2] = $89; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $91 = (_LDDecode($7)|0); //@line 296 "LatticeCrypto_v1.0/kex.c"
  $92 = $91&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $93 = $92&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $94 = $6; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $95 = $94 & 7; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $96 = $93 << $95; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $97 = $6; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $98 = $97 >>> 3; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $99 = $5; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + ($98)|0); //@line 296 "LatticeCrypto_v1.0/kex.c"
  $101 = HEAP8[$100>>0]|0; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $102 = $101&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $103 = $102 | $96; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $104 = $103&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$100>>0] = $104; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $105 = $6; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + 1)|0; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $6 = $106; //@line 290 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 302 "LatticeCrypto_v1.0/kex.c"
}
function _LDDecode($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $1 = $0;
 $3 = 0; //@line 264 "LatticeCrypto_v1.0/kex.c"
 $7 = -98312; //@line 266 "LatticeCrypto_v1.0/kex.c"
 $2 = 0; //@line 268 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $8 = $2; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $9 = ($8>>>0)<(4); //@line 268 "LatticeCrypto_v1.0/kex.c"
  if (!($9)) {
   break;
  }
  $10 = $2; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $11 = $1; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $12 = (($11) + ($10<<2)|0); //@line 269 "LatticeCrypto_v1.0/kex.c"
  $13 = HEAP32[$12>>2]|0; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $14 = $13 >> 31; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $4 = $14; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $15 = $2; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $16 = $1; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $17 = (($16) + ($15<<2)|0); //@line 270 "LatticeCrypto_v1.0/kex.c"
  $18 = HEAP32[$17>>2]|0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $19 = (_Abs($18)|0); //@line 270 "LatticeCrypto_v1.0/kex.c"
  $20 = (49156 - ($19))|0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $21 = $20 >> 31; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $5 = $21; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $22 = $4; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $23 = $7; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $24 = 98312 ^ $23; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $25 = $22 & $24; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $26 = $7; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $27 = $25 ^ $26; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $6 = $27; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $28 = $2; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $29 = $1; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + ($28<<2)|0); //@line 273 "LatticeCrypto_v1.0/kex.c"
  $31 = HEAP32[$30>>2]|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $32 = $5; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $33 = $6; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $34 = $32 & $33; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $35 = (($31) + ($34))|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $36 = (_Abs($35)|0); //@line 273 "LatticeCrypto_v1.0/kex.c"
  $37 = $3; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + ($36))|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $3 = $38; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $39 = $2; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + 1)|0; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $2 = $40; //@line 268 "LatticeCrypto_v1.0/kex.c"
 }
 $41 = $3; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $42 = (98312 - ($41))|0; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $43 = $42 >>> 31; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $44 = $43 ^ 1; //@line 276 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($44|0); //@line 276 "LatticeCrypto_v1.0/kex.c"
}
function _get_error($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 3136|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(3136|0);
 $9 = sp + 64|0;
 $11 = sp + 28|0;
 $12 = sp + 24|0;
 $16 = sp + 56|0;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $10 = $9; //@line 308 "LatticeCrypto_v1.0/kex.c"
 $14 = $11; //@line 310 "LatticeCrypto_v1.0/kex.c"
 $15 = $12; //@line 310 "LatticeCrypto_v1.0/kex.c"
 ;HEAP8[$16>>0]=0|0;HEAP8[$16+1>>0]=0|0;HEAP8[$16+2>>0]=0|0;HEAP8[$16+3>>0]=0|0;HEAP8[$16+4>>0]=0|0;HEAP8[$16+5>>0]=0|0;HEAP8[$16+6>>0]=0|0;HEAP8[$16+7>>0]=0|0; //@line 311 "LatticeCrypto_v1.0/kex.c"
 $19 = 3; //@line 313 "LatticeCrypto_v1.0/kex.c"
 $20 = $7; //@line 315 "LatticeCrypto_v1.0/kex.c"
 $21 = $20&255; //@line 315 "LatticeCrypto_v1.0/kex.c"
 HEAP8[$16>>0] = $21; //@line 315 "LatticeCrypto_v1.0/kex.c"
 $22 = $6; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $23 = $8; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $24 = (_stream_output($22,32,$16,32,3072,$9,$23)|0); //@line 316 "LatticeCrypto_v1.0/kex.c"
 $19 = $24; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $25 = $19; //@line 317 "LatticeCrypto_v1.0/kex.c"
 $26 = ($25|0)!=(0); //@line 317 "LatticeCrypto_v1.0/kex.c"
 if ($26) {
  _clear_words($9,768); //@line 318 "LatticeCrypto_v1.0/kex.c"
  $27 = $19; //@line 319 "LatticeCrypto_v1.0/kex.c"
  $4 = $27; //@line 319 "LatticeCrypto_v1.0/kex.c"
  $130 = $4; //@line 346 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($130|0); //@line 346 "LatticeCrypto_v1.0/kex.c"
 }
 $17 = 0; //@line 325 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $28 = $17; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $29 = ($28>>>0)<(256); //@line 325 "LatticeCrypto_v1.0/kex.c"
  if (!($29)) {
   break;
  }
  HEAP32[$11>>2] = 0; //@line 327 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$12>>2] = 0; //@line 328 "LatticeCrypto_v1.0/kex.c"
  $18 = 0; //@line 329 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $30 = $18; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $31 = ($30>>>0)<(8); //@line 329 "LatticeCrypto_v1.0/kex.c"
   if (!($31)) {
    break;
   }
   $32 = $17; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $33 = $10; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $34 = (($33) + ($32<<2)|0); //@line 330 "LatticeCrypto_v1.0/kex.c"
   $35 = HEAP32[$34>>2]|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $36 = $18; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $37 = $35 >>> $36; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $38 = $37 & 16843009; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $39 = HEAP32[$11>>2]|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $40 = (($39) + ($38))|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$11>>2] = $40; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $41 = $17; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $42 = (($41) + 256)|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $43 = $10; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $44 = (($43) + ($42<<2)|0); //@line 331 "LatticeCrypto_v1.0/kex.c"
   $45 = HEAP32[$44>>2]|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $46 = $18; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $47 = $45 >>> $46; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $48 = $47 & 16843009; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $49 = HEAP32[$12>>2]|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $50 = (($49) + ($48))|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$12>>2] = $50; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $51 = $18; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $52 = (($51) + 1)|0; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $18 = $52; //@line 329 "LatticeCrypto_v1.0/kex.c"
  }
  $18 = 0; //@line 333 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $53 = $18; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $54 = ($53>>>0)<(4); //@line 333 "LatticeCrypto_v1.0/kex.c"
   if (!($54)) {
    break;
   }
   $55 = $17; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $56 = (($55) + 512)|0; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $57 = $10; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $58 = (($57) + ($56<<2)|0); //@line 334 "LatticeCrypto_v1.0/kex.c"
   $59 = HEAP32[$58>>2]|0; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $60 = $18; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $61 = $59 >>> $60; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $13 = $61; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $62 = $13; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $63 = $62 & 16843009; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $64 = HEAP32[$11>>2]|0; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $65 = (($64) + ($63))|0; //@line 335 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$11>>2] = $65; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $66 = $13; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $67 = $66 >>> 4; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $68 = $67 & 16843009; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $69 = HEAP32[$12>>2]|0; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $70 = (($69) + ($68))|0; //@line 336 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$12>>2] = $70; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $71 = $18; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $72 = (($71) + 1)|0; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $18 = $72; //@line 333 "LatticeCrypto_v1.0/kex.c"
  }
  $73 = $14; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $74 = HEAP8[$73>>0]|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $75 = $74&255; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $76 = $14; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $77 = ((($76)) + 1|0); //@line 338 "LatticeCrypto_v1.0/kex.c"
  $78 = HEAP8[$77>>0]|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $79 = $78&255; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $80 = (($75) - ($79))|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $81 = $17; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $82 = $81<<1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $83 = $5; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + ($82<<2)|0); //@line 338 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$84>>2] = $80; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $85 = $14; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $86 = ((($85)) + 2|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  $87 = HEAP8[$86>>0]|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $88 = $87&255; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $89 = $14; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $90 = ((($89)) + 3|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  $91 = HEAP8[$90>>0]|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $92 = $91&255; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $93 = (($88) - ($92))|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $94 = $17; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $95 = $94<<1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + 1)|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $97 = $5; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + ($96<<2)|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$98>>2] = $93; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $99 = $15; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $100 = HEAP8[$99>>0]|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $101 = $100&255; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $102 = $15; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $103 = ((($102)) + 1|0); //@line 340 "LatticeCrypto_v1.0/kex.c"
  $104 = HEAP8[$103>>0]|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $105 = $104&255; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $106 = (($101) - ($105))|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $107 = $17; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $108 = $107<<1; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $109 = (($108) + 512)|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $110 = $5; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + ($109<<2)|0); //@line 340 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$111>>2] = $106; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $112 = $15; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $113 = ((($112)) + 2|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  $114 = HEAP8[$113>>0]|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $115 = $114&255; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $116 = $15; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $117 = ((($116)) + 3|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  $118 = HEAP8[$117>>0]|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $119 = $118&255; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $120 = (($115) - ($119))|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $121 = $17; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $122 = $121<<1; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $123 = (($122) + 512)|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $124 = (($123) + 1)|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $125 = $5; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $126 = (($125) + ($124<<2)|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$126>>2] = $120; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $127 = $17; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $128 = (($127) + 1)|0; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $17 = $128; //@line 325 "LatticeCrypto_v1.0/kex.c"
 }
 $129 = $19; //@line 345 "LatticeCrypto_v1.0/kex.c"
 $4 = $129; //@line 345 "LatticeCrypto_v1.0/kex.c"
 $130 = $4; //@line 346 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($130|0); //@line 346 "LatticeCrypto_v1.0/kex.c"
}
function _generate_a($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $4; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $7 = $3; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $8 = $5; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $9 = (_extended_output($6,32,1024,$7,$8)|0); //@line 352 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($9|0); //@line 352 "LatticeCrypto_v1.0/kex.c"
}
function _KeyGeneration_A($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 8288|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(8288|0);
 $7 = sp + 4104|0;
 $8 = sp + 8|0;
 $9 = sp + 8248|0;
 $10 = sp + 8216|0;
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $11 = 3; //@line 365 "LatticeCrypto_v1.0/kex.c"
 $12 = $6; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $13 = HEAP32[$12>>2]|0; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $14 = (_random_bytes(32,$9,$13)|0); //@line 367 "LatticeCrypto_v1.0/kex.c"
 $11 = $14; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $15 = $11; //@line 368 "LatticeCrypto_v1.0/kex.c"
 $16 = ($15|0)!=(0); //@line 368 "LatticeCrypto_v1.0/kex.c"
 if ($16) {
  $17 = $11; //@line 369 "LatticeCrypto_v1.0/kex.c"
  $3 = $17; //@line 369 "LatticeCrypto_v1.0/kex.c"
  $46 = $3; //@line 402 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($46|0); //@line 402 "LatticeCrypto_v1.0/kex.c"
 }
 $18 = $6; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $19 = HEAP32[$18>>2]|0; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $20 = (_random_bytes(32,$10,$19)|0); //@line 371 "LatticeCrypto_v1.0/kex.c"
 $11 = $20; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $21 = $11; //@line 372 "LatticeCrypto_v1.0/kex.c"
 $22 = ($21|0)!=(0); //@line 372 "LatticeCrypto_v1.0/kex.c"
 if (!($22)) {
  $23 = $6; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $24 = ((($23)) + 4|0); //@line 376 "LatticeCrypto_v1.0/kex.c"
  $25 = HEAP32[$24>>2]|0; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $26 = (_generate_a($7,$9,$25)|0); //@line 376 "LatticeCrypto_v1.0/kex.c"
  $11 = $26; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $27 = $11; //@line 377 "LatticeCrypto_v1.0/kex.c"
  $28 = ($27|0)!=(0); //@line 377 "LatticeCrypto_v1.0/kex.c"
  if (!($28)) {
   $29 = $4; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $30 = $6; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $31 = ((($30)) + 8|0); //@line 381 "LatticeCrypto_v1.0/kex.c"
   $32 = HEAP32[$31>>2]|0; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $33 = (_get_error($29,$10,0,$32)|0); //@line 381 "LatticeCrypto_v1.0/kex.c"
   $11 = $33; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $34 = $11; //@line 382 "LatticeCrypto_v1.0/kex.c"
   $35 = ($34|0)!=(0); //@line 382 "LatticeCrypto_v1.0/kex.c"
   if (!($35)) {
    $36 = $6; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $37 = ((($36)) + 8|0); //@line 385 "LatticeCrypto_v1.0/kex.c"
    $38 = HEAP32[$37>>2]|0; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $39 = (_get_error($8,$10,1,$38)|0); //@line 385 "LatticeCrypto_v1.0/kex.c"
    $11 = $39; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $40 = $11; //@line 386 "LatticeCrypto_v1.0/kex.c"
    $41 = ($40|0)!=(0); //@line 386 "LatticeCrypto_v1.0/kex.c"
    if (!($41)) {
     $42 = $4; //@line 389 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($42,36,1024); //@line 389 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($8,36,1024); //@line 390 "LatticeCrypto_v1.0/kex.c"
     _smul($8,3,1024); //@line 391 "LatticeCrypto_v1.0/kex.c"
     $43 = $4; //@line 393 "LatticeCrypto_v1.0/kex.c"
     _pmuladd($7,$43,$8,$7,1024); //@line 393 "LatticeCrypto_v1.0/kex.c"
     _correction($7,12289,1024); //@line 394 "LatticeCrypto_v1.0/kex.c"
     $44 = $5; //@line 395 "LatticeCrypto_v1.0/kex.c"
     _encode_A($7,$9,$44); //@line 395 "LatticeCrypto_v1.0/kex.c"
    }
   }
  }
 }
 _clear_words($8,1024); //@line 398 "LatticeCrypto_v1.0/kex.c"
 _clear_words($10,8); //@line 399 "LatticeCrypto_v1.0/kex.c"
 $45 = $11; //@line 401 "LatticeCrypto_v1.0/kex.c"
 $3 = $45; //@line 401 "LatticeCrypto_v1.0/kex.c"
 $46 = $3; //@line 402 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($46|0); //@line 402 "LatticeCrypto_v1.0/kex.c"
}
function _SecretAgreement_B($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 24672|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(24672|0);
 $8 = sp + 20488|0;
 $9 = sp + 16392|0;
 $10 = sp + 12296|0;
 $11 = sp + 8200|0;
 $12 = sp + 4104|0;
 $13 = sp + 8|0;
 $14 = sp + 24632|0;
 $15 = sp + 24600|0;
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $16 = 3; //@line 416 "LatticeCrypto_v1.0/kex.c"
 $17 = $4; //@line 418 "LatticeCrypto_v1.0/kex.c"
 _decode_A($17,$8,$14); //@line 418 "LatticeCrypto_v1.0/kex.c"
 $18 = $7; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $19 = HEAP32[$18>>2]|0; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $20 = (_random_bytes(32,$15,$19)|0); //@line 419 "LatticeCrypto_v1.0/kex.c"
 $16 = $20; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $21 = $16; //@line 420 "LatticeCrypto_v1.0/kex.c"
 $22 = ($21|0)!=(0); //@line 420 "LatticeCrypto_v1.0/kex.c"
 if (!($22)) {
  $23 = $7; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $24 = ((($23)) + 4|0); //@line 424 "LatticeCrypto_v1.0/kex.c"
  $25 = HEAP32[$24>>2]|0; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $26 = (_generate_a($9,$14,$25)|0); //@line 424 "LatticeCrypto_v1.0/kex.c"
  $16 = $26; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $27 = $16; //@line 425 "LatticeCrypto_v1.0/kex.c"
  $28 = ($27|0)!=(0); //@line 425 "LatticeCrypto_v1.0/kex.c"
  if (!($28)) {
   $29 = $7; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $30 = ((($29)) + 8|0); //@line 429 "LatticeCrypto_v1.0/kex.c"
   $31 = HEAP32[$30>>2]|0; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $32 = (_get_error($12,$15,0,$31)|0); //@line 429 "LatticeCrypto_v1.0/kex.c"
   $16 = $32; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $33 = $16; //@line 430 "LatticeCrypto_v1.0/kex.c"
   $34 = ($33|0)!=(0); //@line 430 "LatticeCrypto_v1.0/kex.c"
   if (!($34)) {
    $35 = $7; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $36 = ((($35)) + 8|0); //@line 433 "LatticeCrypto_v1.0/kex.c"
    $37 = HEAP32[$36>>2]|0; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $38 = (_get_error($13,$15,1,$37)|0); //@line 433 "LatticeCrypto_v1.0/kex.c"
    $16 = $38; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $39 = $16; //@line 434 "LatticeCrypto_v1.0/kex.c"
    $40 = ($39|0)!=(0); //@line 434 "LatticeCrypto_v1.0/kex.c"
    if (!($40)) {
     _NTT_CT_std2rev_12289($12,36,1024); //@line 437 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($13,36,1024); //@line 438 "LatticeCrypto_v1.0/kex.c"
     _smul($13,3,1024); //@line 439 "LatticeCrypto_v1.0/kex.c"
     _pmuladd($9,$12,$13,$9,1024); //@line 441 "LatticeCrypto_v1.0/kex.c"
     _correction($9,12289,1024); //@line 442 "LatticeCrypto_v1.0/kex.c"
     $41 = $7; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $42 = ((($41)) + 8|0); //@line 444 "LatticeCrypto_v1.0/kex.c"
     $43 = HEAP32[$42>>2]|0; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $44 = (_get_error($13,$15,2,$43)|0); //@line 444 "LatticeCrypto_v1.0/kex.c"
     $16 = $44; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $45 = $16; //@line 445 "LatticeCrypto_v1.0/kex.c"
     $46 = ($45|0)!=(0); //@line 445 "LatticeCrypto_v1.0/kex.c"
     if (!($46)) {
      _NTT_CT_std2rev_12289($13,36,1024); //@line 448 "LatticeCrypto_v1.0/kex.c"
      _smul($13,81,1024); //@line 449 "LatticeCrypto_v1.0/kex.c"
      _pmuladd($8,$12,$13,$10,1024); //@line 451 "LatticeCrypto_v1.0/kex.c"
      $47 = HEAP32[8]|0; //@line 452 "LatticeCrypto_v1.0/kex.c"
      $48 = HEAP32[7]|0; //@line 452 "LatticeCrypto_v1.0/kex.c"
      _INTT_GS_rev2std_12289($10,4132,$47,$48,1024); //@line 452 "LatticeCrypto_v1.0/kex.c"
      _two_reduce12289($10,1024); //@line 453 "LatticeCrypto_v1.0/kex.c"
      _correction($10,12289,1024); //@line 455 "LatticeCrypto_v1.0/kex.c"
      $49 = $7; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $50 = ((($49)) + 8|0); //@line 458 "LatticeCrypto_v1.0/kex.c"
      $51 = HEAP32[$50>>2]|0; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $52 = (_HelpRec($10,$11,$15,3,$51)|0); //@line 458 "LatticeCrypto_v1.0/kex.c"
      $16 = $52; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $53 = $16; //@line 459 "LatticeCrypto_v1.0/kex.c"
      $54 = ($53|0)!=(0); //@line 459 "LatticeCrypto_v1.0/kex.c"
      if (!($54)) {
       $55 = $5; //@line 462 "LatticeCrypto_v1.0/kex.c"
       _Rec($10,$11,$55); //@line 462 "LatticeCrypto_v1.0/kex.c"
       $56 = $6; //@line 463 "LatticeCrypto_v1.0/kex.c"
       _encode_B($9,$11,$56); //@line 463 "LatticeCrypto_v1.0/kex.c"
      }
     }
    }
   }
  }
 }
 _clear_words($12,1024); //@line 466 "LatticeCrypto_v1.0/kex.c"
 _clear_words($13,1024); //@line 467 "LatticeCrypto_v1.0/kex.c"
 _clear_words($15,8); //@line 468 "LatticeCrypto_v1.0/kex.c"
 _clear_words($9,1024); //@line 469 "LatticeCrypto_v1.0/kex.c"
 _clear_words($10,1024); //@line 470 "LatticeCrypto_v1.0/kex.c"
 _clear_words($11,1024); //@line 471 "LatticeCrypto_v1.0/kex.c"
 $57 = $16; //@line 473 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($57|0); //@line 473 "LatticeCrypto_v1.0/kex.c"
}
function _SecretAgreement_A($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 8224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(8224|0);
 $6 = sp + 4104|0;
 $7 = sp + 8|0;
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $8 = 0; //@line 485 "LatticeCrypto_v1.0/kex.c"
 $9 = $3; //@line 487 "LatticeCrypto_v1.0/kex.c"
 _decode_B($9,$6,$7); //@line 487 "LatticeCrypto_v1.0/kex.c"
 $10 = $4; //@line 489 "LatticeCrypto_v1.0/kex.c"
 _pmul($10,$6,$6,1024); //@line 489 "LatticeCrypto_v1.0/kex.c"
 $11 = HEAP32[8]|0; //@line 490 "LatticeCrypto_v1.0/kex.c"
 $12 = HEAP32[7]|0; //@line 490 "LatticeCrypto_v1.0/kex.c"
 _INTT_GS_rev2std_12289($6,4132,$11,$12,1024); //@line 490 "LatticeCrypto_v1.0/kex.c"
 _two_reduce12289($6,1024); //@line 491 "LatticeCrypto_v1.0/kex.c"
 _correction($6,12289,1024); //@line 493 "LatticeCrypto_v1.0/kex.c"
 $13 = $5; //@line 496 "LatticeCrypto_v1.0/kex.c"
 _Rec($6,$7,$13); //@line 496 "LatticeCrypto_v1.0/kex.c"
 _clear_words($6,1024); //@line 499 "LatticeCrypto_v1.0/kex.c"
 _clear_words($7,1024); //@line 500 "LatticeCrypto_v1.0/kex.c"
 $14 = $8; //@line 502 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($14|0); //@line 502 "LatticeCrypto_v1.0/kex.c"
}
function _random_bytes($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $5; //@line 20 "LatticeCrypto_v1.0/random.c"
 $8 = ($7|0)==(0|0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $9 = $6; //@line 20 "LatticeCrypto_v1.0/random.c"
 $10 = ($9|0)==(0|0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $or$cond = $8 | $10; //@line 20 "LatticeCrypto_v1.0/random.c"
 $11 = $4; //@line 20 "LatticeCrypto_v1.0/random.c"
 $12 = ($11|0)==(0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $12; //@line 20 "LatticeCrypto_v1.0/random.c"
 if ($or$cond3) {
  $3 = 6; //@line 21 "LatticeCrypto_v1.0/random.c"
  $17 = $3; //@line 25 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($17|0); //@line 25 "LatticeCrypto_v1.0/random.c"
 } else {
  $13 = $6; //@line 24 "LatticeCrypto_v1.0/random.c"
  $14 = $4; //@line 24 "LatticeCrypto_v1.0/random.c"
  $15 = $5; //@line 24 "LatticeCrypto_v1.0/random.c"
  $16 = (FUNCTION_TABLE_iii[$13 & 31]($14,$15)|0); //@line 24 "LatticeCrypto_v1.0/random.c"
  $3 = $16; //@line 24 "LatticeCrypto_v1.0/random.c"
  $17 = $3; //@line 25 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($17|0); //@line 25 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _extended_output($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 $11 = $6; //@line 33 "LatticeCrypto_v1.0/random.c"
 $12 = ($11|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $13 = $9; //@line 33 "LatticeCrypto_v1.0/random.c"
 $14 = ($13|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond = $12 | $14; //@line 33 "LatticeCrypto_v1.0/random.c"
 $15 = $10; //@line 33 "LatticeCrypto_v1.0/random.c"
 $16 = ($15|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $16; //@line 33 "LatticeCrypto_v1.0/random.c"
 $17 = $7; //@line 33 "LatticeCrypto_v1.0/random.c"
 $18 = ($17|0)==(0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond5 = $or$cond3 | $18; //@line 33 "LatticeCrypto_v1.0/random.c"
 $19 = $8; //@line 33 "LatticeCrypto_v1.0/random.c"
 $20 = ($19|0)==(0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond7 = $or$cond5 | $20; //@line 33 "LatticeCrypto_v1.0/random.c"
 if ($or$cond7) {
  $5 = 6; //@line 34 "LatticeCrypto_v1.0/random.c"
  $27 = $5; //@line 38 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($27|0); //@line 38 "LatticeCrypto_v1.0/random.c"
 } else {
  $21 = $10; //@line 37 "LatticeCrypto_v1.0/random.c"
  $22 = $6; //@line 37 "LatticeCrypto_v1.0/random.c"
  $23 = $7; //@line 37 "LatticeCrypto_v1.0/random.c"
  $24 = $8; //@line 37 "LatticeCrypto_v1.0/random.c"
  $25 = $9; //@line 37 "LatticeCrypto_v1.0/random.c"
  $26 = (FUNCTION_TABLE_iiiii[$21 & 31]($22,$23,$24,$25)|0); //@line 37 "LatticeCrypto_v1.0/random.c"
  $5 = $26; //@line 37 "LatticeCrypto_v1.0/random.c"
  $27 = $5; //@line 38 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($27|0); //@line 38 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _stream_output($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, $or$cond9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $8 = $0;
 $9 = $1;
 $10 = $2;
 $11 = $3;
 $12 = $4;
 $13 = $5;
 $14 = $6;
 $15 = $8; //@line 46 "LatticeCrypto_v1.0/random.c"
 $16 = ($15|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $17 = $13; //@line 46 "LatticeCrypto_v1.0/random.c"
 $18 = ($17|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond = $16 | $18; //@line 46 "LatticeCrypto_v1.0/random.c"
 $19 = $14; //@line 46 "LatticeCrypto_v1.0/random.c"
 $20 = ($19|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $20; //@line 46 "LatticeCrypto_v1.0/random.c"
 $21 = $9; //@line 46 "LatticeCrypto_v1.0/random.c"
 $22 = ($21|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond5 = $or$cond3 | $22; //@line 46 "LatticeCrypto_v1.0/random.c"
 $23 = $11; //@line 46 "LatticeCrypto_v1.0/random.c"
 $24 = ($23|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond7 = $or$cond5 | $24; //@line 46 "LatticeCrypto_v1.0/random.c"
 $25 = $12; //@line 46 "LatticeCrypto_v1.0/random.c"
 $26 = ($25|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond9 = $or$cond7 | $26; //@line 46 "LatticeCrypto_v1.0/random.c"
 if ($or$cond9) {
  $7 = 6; //@line 47 "LatticeCrypto_v1.0/random.c"
  $35 = $7; //@line 51 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($35|0); //@line 51 "LatticeCrypto_v1.0/random.c"
 } else {
  $27 = $14; //@line 50 "LatticeCrypto_v1.0/random.c"
  $28 = $8; //@line 50 "LatticeCrypto_v1.0/random.c"
  $29 = $9; //@line 50 "LatticeCrypto_v1.0/random.c"
  $30 = $10; //@line 50 "LatticeCrypto_v1.0/random.c"
  $31 = $11; //@line 50 "LatticeCrypto_v1.0/random.c"
  $32 = $12; //@line 50 "LatticeCrypto_v1.0/random.c"
  $33 = $13; //@line 50 "LatticeCrypto_v1.0/random.c"
  $34 = (FUNCTION_TABLE_iiiiiii[$27 & 31]($28,$29,$30,$31,$32,$33)|0); //@line 50 "LatticeCrypto_v1.0/random.c"
  $7 = $34; //@line 50 "LatticeCrypto_v1.0/random.c"
  $35 = $7; //@line 51 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($35|0); //@line 51 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _rlwejs_randombytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $3; //@line 18 "rlwe.c"
 $5 = $2; //@line 18 "rlwe.c"
 _randombytes_buf($4,$5); //@line 18 "rlwe.c"
 STACKTOP = sp;return 0; //@line 19 "rlwe.c"
}
function _rlwejs_streamoutput($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $7 = $0;
 $8 = $1;
 $9 = $2;
 $10 = $3;
 $11 = $4;
 $12 = $5;
 $16 = $7; //@line 30 "rlwe.c"
 $13 = $16; //@line 30 "rlwe.c"
 $17 = $8; //@line 31 "rlwe.c"
 $18 = ($17>>>0)<(32); //@line 31 "rlwe.c"
 if ($18) {
  $19 = (_calloc(32,1)|0); //@line 32 "rlwe.c"
  $13 = $19; //@line 32 "rlwe.c"
  $20 = $8; //@line 33 "rlwe.c"
  $21 = ($20>>>0)>(0); //@line 33 "rlwe.c"
  if ($21) {
   $22 = $13; //@line 34 "rlwe.c"
   $23 = $7; //@line 34 "rlwe.c"
   $24 = $8; //@line 34 "rlwe.c"
   _memcpy(($22|0),($23|0),($24|0))|0; //@line 34 "rlwe.c"
  }
 }
 $25 = $9; //@line 38 "rlwe.c"
 $14 = $25; //@line 38 "rlwe.c"
 $26 = $10; //@line 39 "rlwe.c"
 $27 = ($26>>>0)<(8); //@line 39 "rlwe.c"
 if ($27) {
  $28 = (_calloc(8,1)|0); //@line 40 "rlwe.c"
  $14 = $28; //@line 40 "rlwe.c"
  $29 = $10; //@line 41 "rlwe.c"
  $30 = ($29>>>0)>(0); //@line 41 "rlwe.c"
  if ($30) {
   $31 = $14; //@line 42 "rlwe.c"
   $32 = $9; //@line 42 "rlwe.c"
   $33 = $10; //@line 42 "rlwe.c"
   _memcpy(($31|0),($32|0),($33|0))|0; //@line 42 "rlwe.c"
  }
 }
 $34 = $12; //@line 46 "rlwe.c"
 $35 = $11; //@line 46 "rlwe.c"
 $36 = $14; //@line 46 "rlwe.c"
 $37 = $13; //@line 46 "rlwe.c"
 $38 = (_crypto_stream_chacha20($34,$35,0,$36,$37)|0); //@line 46 "rlwe.c"
 $15 = $38; //@line 46 "rlwe.c"
 $39 = $13; //@line 48 "rlwe.c"
 $40 = $7; //@line 48 "rlwe.c"
 $41 = ($39|0)!=($40|0); //@line 48 "rlwe.c"
 if ($41) {
  $42 = $13; //@line 49 "rlwe.c"
  _sodium_memzero($42,32); //@line 49 "rlwe.c"
  $43 = $13; //@line 50 "rlwe.c"
  _free($43); //@line 50 "rlwe.c"
 }
 $44 = $14; //@line 53 "rlwe.c"
 $45 = $9; //@line 53 "rlwe.c"
 $46 = ($44|0)!=($45|0); //@line 53 "rlwe.c"
 if ($46) {
  $47 = $14; //@line 54 "rlwe.c"
  _sodium_memzero($47,8); //@line 54 "rlwe.c"
  $48 = $14; //@line 55 "rlwe.c"
  _free($48); //@line 55 "rlwe.c"
 }
 $49 = $15; //@line 58 "rlwe.c"
 $50 = ($49|0)!=(0); //@line 58 "rlwe.c"
 if ($50) {
  $6 = 3; //@line 59 "rlwe.c"
  $51 = $6; //@line 63 "rlwe.c"
  STACKTOP = sp;return ($51|0); //@line 63 "rlwe.c"
 } else {
  $6 = 0; //@line 62 "rlwe.c"
  $51 = $6; //@line 63 "rlwe.c"
  STACKTOP = sp;return ($51|0); //@line 63 "rlwe.c"
 }
 return (0)|0;
}
function _rlwejs_extendableoutput($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $11 = $5; //@line 72 "rlwe.c"
 $12 = $6; //@line 73 "rlwe.c"
 $13 = $7; //@line 76 "rlwe.c"
 $14 = $13<<2; //@line 76 "rlwe.c"
 $15 = $8; //@line 77 "rlwe.c"
 $16 = (_rlwejs_streamoutput($11,$12,0,0,$14,$15)|0); //@line 71 "rlwe.c"
 $9 = $16; //@line 71 "rlwe.c"
 $17 = $9; //@line 80 "rlwe.c"
 $18 = ($17|0)!=(0); //@line 80 "rlwe.c"
 if ($18) {
  $19 = $9; //@line 81 "rlwe.c"
  $4 = $19; //@line 81 "rlwe.c"
  $33 = $4; //@line 89 "rlwe.c"
  STACKTOP = sp;return ($33|0); //@line 89 "rlwe.c"
 }
 $10 = 0; //@line 84 "rlwe.c"
 while(1) {
  $20 = $10; //@line 84 "rlwe.c"
  $21 = $7; //@line 84 "rlwe.c"
  $22 = ($20>>>0)<($21>>>0); //@line 84 "rlwe.c"
  if (!($22)) {
   break;
  }
  $23 = $10; //@line 85 "rlwe.c"
  $24 = $8; //@line 85 "rlwe.c"
  $25 = (($24) + ($23<<2)|0); //@line 85 "rlwe.c"
  $26 = HEAP32[$25>>2]|0; //@line 85 "rlwe.c"
  $27 = (($26>>>0) % 12289)&-1; //@line 85 "rlwe.c"
  $28 = $10; //@line 85 "rlwe.c"
  $29 = $8; //@line 85 "rlwe.c"
  $30 = (($29) + ($28<<2)|0); //@line 85 "rlwe.c"
  HEAP32[$30>>2] = $27; //@line 85 "rlwe.c"
  $31 = $10; //@line 84 "rlwe.c"
  $32 = (($31) + 1)|0; //@line 84 "rlwe.c"
  $10 = $32; //@line 84 "rlwe.c"
 }
 $4 = 0; //@line 88 "rlwe.c"
 $33 = $4; //@line 89 "rlwe.c"
 STACKTOP = sp;return ($33|0); //@line 89 "rlwe.c"
}
function _rlwejs_init() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _randombytes_stir(); //@line 92 "rlwe.c"
 $0 = (_LatticeCrypto_allocate()|0); //@line 94 "rlwe.c"
 HEAP32[2245] = $0; //@line 94 "rlwe.c"
 $1 = HEAP32[2245]|0; //@line 97 "rlwe.c"
 $2 = (_LatticeCrypto_initialize($1,18,18,18)|0); //@line 96 "rlwe.c"
 return ($2|0); //@line 96 "rlwe.c"
}
function _rlwejs_public_key_bytes() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[2057]|0; //@line 105 "rlwe.c"
 $1 = (($0) + 1)|0; //@line 105 "rlwe.c"
 return ($1|0); //@line 105 "rlwe.c"
}
function _rlwejs_private_key_bytes() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[2058]|0; //@line 109 "rlwe.c"
 $1 = (($0) + 1)|0; //@line 109 "rlwe.c"
 $2 = $1<<2; //@line 109 "rlwe.c"
 return ($2|0); //@line 109 "rlwe.c"
}
function _rlwejs_secret_bytes() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 32; //@line 113 "rlwe.c"
}
function _rlwejs_keypair_alice($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $5 = $3; //@line 120 "rlwe.c"
 $6 = $2; //@line 120 "rlwe.c"
 $7 = HEAP32[2245]|0; //@line 120 "rlwe.c"
 $8 = (_KeyGeneration_A($5,$6,$7)|0); //@line 120 "rlwe.c"
 $4 = $8; //@line 120 "rlwe.c"
 $9 = HEAP32[2057]|0; //@line 122 "rlwe.c"
 $10 = $2; //@line 122 "rlwe.c"
 $11 = (($10) + ($9)|0); //@line 122 "rlwe.c"
 HEAP8[$11>>0] = 1; //@line 122 "rlwe.c"
 $12 = HEAP32[2058]|0; //@line 123 "rlwe.c"
 $13 = $3; //@line 123 "rlwe.c"
 $14 = (($13) + ($12<<2)|0); //@line 123 "rlwe.c"
 HEAP32[$14>>2] = 1; //@line 123 "rlwe.c"
 $15 = $4; //@line 125 "rlwe.c"
 STACKTOP = sp;return ($15|0); //@line 125 "rlwe.c"
}
function _rlwejs_secret_alice($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = HEAP32[2057]|0; //@line 133 "rlwe.c"
 $8 = $4; //@line 133 "rlwe.c"
 $9 = (($8) + ($7)|0); //@line 133 "rlwe.c"
 $10 = HEAP8[$9>>0]|0; //@line 133 "rlwe.c"
 $11 = $10&255; //@line 133 "rlwe.c"
 $12 = ($11|0)!=(0); //@line 133 "rlwe.c"
 if (!($12)) {
  $13 = HEAP32[2058]|0; //@line 133 "rlwe.c"
  $14 = $5; //@line 133 "rlwe.c"
  $15 = (($14) + ($13<<2)|0); //@line 133 "rlwe.c"
  $16 = HEAP32[$15>>2]|0; //@line 133 "rlwe.c"
  $17 = ($16|0)!=(0); //@line 133 "rlwe.c"
  if ($17) {
   $18 = $4; //@line 137 "rlwe.c"
   $19 = $5; //@line 137 "rlwe.c"
   $20 = $6; //@line 137 "rlwe.c"
   $21 = (_SecretAgreement_A($18,$19,$20)|0); //@line 137 "rlwe.c"
   $3 = $21; //@line 137 "rlwe.c"
   $22 = $3; //@line 138 "rlwe.c"
   STACKTOP = sp;return ($22|0); //@line 138 "rlwe.c"
  }
 }
 $3 = 6; //@line 134 "rlwe.c"
 $22 = $3; //@line 138 "rlwe.c"
 STACKTOP = sp;return ($22|0); //@line 138 "rlwe.c"
}
function _rlwejs_secret_bob($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $8 = HEAP32[2057]|0; //@line 145 "rlwe.c"
 $9 = $4; //@line 145 "rlwe.c"
 $10 = (($9) + ($8)|0); //@line 145 "rlwe.c"
 $11 = HEAP8[$10>>0]|0; //@line 145 "rlwe.c"
 $12 = ($11<<24>>24)!=(0); //@line 145 "rlwe.c"
 if ($12) {
  $13 = $4; //@line 149 "rlwe.c"
  $14 = $6; //@line 149 "rlwe.c"
  $15 = $5; //@line 149 "rlwe.c"
  $16 = HEAP32[2245]|0; //@line 149 "rlwe.c"
  $17 = (_SecretAgreement_B($13,$14,$15,$16)|0); //@line 149 "rlwe.c"
  $7 = $17; //@line 149 "rlwe.c"
  $18 = HEAP32[2057]|0; //@line 151 "rlwe.c"
  $19 = $5; //@line 151 "rlwe.c"
  $20 = (($19) + ($18)|0); //@line 151 "rlwe.c"
  HEAP8[$20>>0] = 0; //@line 151 "rlwe.c"
  $21 = $7; //@line 153 "rlwe.c"
  $3 = $21; //@line 153 "rlwe.c"
  $22 = $3; //@line 154 "rlwe.c"
  STACKTOP = sp;return ($22|0); //@line 154 "rlwe.c"
 } else {
  $3 = 6; //@line 146 "rlwe.c"
  $22 = $3; //@line 154 "rlwe.c"
  STACKTOP = sp;return ($22|0); //@line 154 "rlwe.c"
 }
 return (0)|0;
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[2246]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 9028;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 64|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0190$i = 0, $$$0191$i = 0, $$$4349$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i17$i = 0, $$0$i18$i = 0, $$01$i$i = 0, $$0187$i = 0, $$0189$i = 0, $$0190$i = 0, $$0191$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0;
 var $$024370$i = 0, $$0286$i$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0294$i$i = 0, $$0295$i$i = 0, $$0340$i = 0, $$0342$i = 0, $$0343$i = 0, $$0345$i = 0, $$0351$i = 0, $$0356$i = 0, $$0357$$i = 0, $$0357$i = 0, $$0359$i = 0, $$0360$i = 0, $$0366$i = 0, $$1194$i = 0, $$1196$i = 0, $$124469$i = 0;
 var $$1290$i$i = 0, $$1292$i$i = 0, $$1341$i = 0, $$1346$i = 0, $$1361$i = 0, $$1368$i = 0, $$1372$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2353$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i201 = 0, $$3348$i = 0, $$3370$i = 0, $$4$lcssa$i = 0, $$413$i = 0, $$4349$lcssa$i = 0, $$434912$i = 0, $$4355$$4$i = 0;
 var $$4355$ph$i = 0, $$435511$i = 0, $$5256$i = 0, $$723947$i = 0, $$748$i = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i19$i = 0, $$pre$i205 = 0, $$pre$i208 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i20$iZ2D = 0, $$pre$phi$i206Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre9$i$i = 0, $1 = 0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0;
 var $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0;
 var $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0;
 var $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0;
 var $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0;
 var $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0;
 var $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0;
 var $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0;
 var $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0;
 var $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0;
 var $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0;
 var $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0;
 var $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0;
 var $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0;
 var $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0;
 var $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0;
 var $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0;
 var $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0;
 var $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0;
 var $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0;
 var $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0;
 var $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0;
 var $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0;
 var $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0;
 var $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0;
 var $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0;
 var $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0;
 var $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0;
 var $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0;
 var $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0;
 var $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0;
 var $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0;
 var $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0;
 var $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0;
 var $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0;
 var $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0;
 var $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0;
 var $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0;
 var $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0;
 var $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0;
 var $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0;
 var $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0;
 var $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0;
 var $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0;
 var $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i204 = 0, $exitcond$i$i = 0, $not$$i$i = 0, $not$$i22$i = 0;
 var $not$7$i = 0, $or$cond$i = 0, $or$cond$i211 = 0, $or$cond1$i = 0, $or$cond1$i210 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[2258]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (9072 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[2258] = $24;
     } else {
      $25 = HEAP32[(9048)>>2]|0;
      $26 = ($20>>>0)<($25>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(9040)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (9072 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($69|0)==($73|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[2258] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(9048)>>2]|0;
       $79 = ($73>>>0)<($78>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($87) + ($84)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(9052)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (9072 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[2258] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(9048)>>2]|0;
       $104 = ($102>>>0)<($103>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(9040)>>2] = $84;
     HEAP32[(9052)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(9036)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (9336 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $$0189$i = $134;$$0190$i = $134;$$0191$i = $138;
     while(1) {
      $139 = ((($$0189$i)) + 16|0);
      $140 = HEAP32[$139>>2]|0;
      $141 = ($140|0)==(0|0);
      if ($141) {
       $142 = ((($$0189$i)) + 20|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        break;
       } else {
        $146 = $143;
       }
      } else {
       $146 = $140;
      }
      $145 = ((($146)) + 4|0);
      $147 = HEAP32[$145>>2]|0;
      $148 = $147 & -8;
      $149 = (($148) - ($6))|0;
      $150 = ($149>>>0)<($$0191$i>>>0);
      $$$0191$i = $150 ? $149 : $$0191$i;
      $$$0190$i = $150 ? $146 : $$0190$i;
      $$0189$i = $146;$$0190$i = $$$0190$i;$$0191$i = $$$0191$i;
     }
     $151 = HEAP32[(9048)>>2]|0;
     $152 = ($$0190$i>>>0)<($151>>>0);
     if ($152) {
      _abort();
      // unreachable;
     }
     $153 = (($$0190$i) + ($6)|0);
     $154 = ($$0190$i>>>0)<($153>>>0);
     if (!($154)) {
      _abort();
      // unreachable;
     }
     $155 = ((($$0190$i)) + 24|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ((($$0190$i)) + 12|0);
     $158 = HEAP32[$157>>2]|0;
     $159 = ($158|0)==($$0190$i|0);
     do {
      if ($159) {
       $169 = ((($$0190$i)) + 20|0);
       $170 = HEAP32[$169>>2]|0;
       $171 = ($170|0)==(0|0);
       if ($171) {
        $172 = ((($$0190$i)) + 16|0);
        $173 = HEAP32[$172>>2]|0;
        $174 = ($173|0)==(0|0);
        if ($174) {
         $$3$i = 0;
         break;
        } else {
         $$1194$i = $173;$$1196$i = $172;
        }
       } else {
        $$1194$i = $170;$$1196$i = $169;
       }
       while(1) {
        $175 = ((($$1194$i)) + 20|0);
        $176 = HEAP32[$175>>2]|0;
        $177 = ($176|0)==(0|0);
        if (!($177)) {
         $$1194$i = $176;$$1196$i = $175;
         continue;
        }
        $178 = ((($$1194$i)) + 16|0);
        $179 = HEAP32[$178>>2]|0;
        $180 = ($179|0)==(0|0);
        if ($180) {
         break;
        } else {
         $$1194$i = $179;$$1196$i = $178;
        }
       }
       $181 = ($$1196$i>>>0)<($151>>>0);
       if ($181) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1196$i>>2] = 0;
        $$3$i = $$1194$i;
        break;
       }
      } else {
       $160 = ((($$0190$i)) + 8|0);
       $161 = HEAP32[$160>>2]|0;
       $162 = ($161>>>0)<($151>>>0);
       if ($162) {
        _abort();
        // unreachable;
       }
       $163 = ((($161)) + 12|0);
       $164 = HEAP32[$163>>2]|0;
       $165 = ($164|0)==($$0190$i|0);
       if (!($165)) {
        _abort();
        // unreachable;
       }
       $166 = ((($158)) + 8|0);
       $167 = HEAP32[$166>>2]|0;
       $168 = ($167|0)==($$0190$i|0);
       if ($168) {
        HEAP32[$163>>2] = $158;
        HEAP32[$166>>2] = $161;
        $$3$i = $158;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $182 = ($156|0)==(0|0);
     do {
      if (!($182)) {
       $183 = ((($$0190$i)) + 28|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = (9336 + ($184<<2)|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($$0190$i|0)==($186|0);
       if ($187) {
        HEAP32[$185>>2] = $$3$i;
        $cond$i = ($$3$i|0)==(0|0);
        if ($cond$i) {
         $188 = 1 << $184;
         $189 = $188 ^ -1;
         $190 = $108 & $189;
         HEAP32[(9036)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(9048)>>2]|0;
        $192 = ($156>>>0)<($191>>>0);
        if ($192) {
         _abort();
         // unreachable;
        }
        $193 = ((($156)) + 16|0);
        $194 = HEAP32[$193>>2]|0;
        $195 = ($194|0)==($$0190$i|0);
        if ($195) {
         HEAP32[$193>>2] = $$3$i;
        } else {
         $196 = ((($156)) + 20|0);
         HEAP32[$196>>2] = $$3$i;
        }
        $197 = ($$3$i|0)==(0|0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[(9048)>>2]|0;
       $199 = ($$3$i>>>0)<($198>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($$3$i)) + 24|0);
       HEAP32[$200>>2] = $156;
       $201 = ((($$0190$i)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($202>>>0)<($198>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($$0190$i)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(9048)>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($$0191$i>>>0)<(16);
     if ($214) {
      $215 = (($$0191$i) + ($6))|0;
      $216 = $215 | 3;
      $217 = ((($$0190$i)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($$0190$i) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $6 | 3;
      $223 = ((($$0190$i)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $$0191$i | 1;
      $225 = ((($153)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($153) + ($$0191$i)|0);
      HEAP32[$226>>2] = $$0191$i;
      $227 = ($37|0)==(0);
      if (!($227)) {
       $228 = HEAP32[(9052)>>2]|0;
       $229 = $37 >>> 3;
       $230 = $229 << 1;
       $231 = (9072 + ($230<<2)|0);
       $232 = 1 << $229;
       $233 = $8 & $232;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $8 | $232;
        HEAP32[2258] = $235;
        $$pre$i = ((($231)) + 8|0);
        $$0187$i = $231;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $236 = ((($231)) + 8|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(9048)>>2]|0;
        $239 = ($237>>>0)<($238>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$0187$i = $237;$$pre$phi$iZ2D = $236;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $228;
       $240 = ((($$0187$i)) + 12|0);
       HEAP32[$240>>2] = $228;
       $241 = ((($228)) + 8|0);
       HEAP32[$241>>2] = $$0187$i;
       $242 = ((($228)) + 12|0);
       HEAP32[$242>>2] = $231;
      }
      HEAP32[(9040)>>2] = $$0191$i;
      HEAP32[(9052)>>2] = $153;
     }
     $243 = ((($$0190$i)) + 8|0);
     $$0 = $243;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $244 = ($0>>>0)>(4294967231);
   if ($244) {
    $$0197 = -1;
   } else {
    $245 = (($0) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(9036)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $$0197 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $$0356$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $$0356$i = 31;
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
       $$0356$i = $274;
      }
     }
     $275 = (9336 + ($$0356$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L123: do {
      if ($277) {
       $$2353$i = 0;$$3$i201 = 0;$$3348$i = $249;
       label = 86;
      } else {
       $278 = ($$0356$i|0)==(31);
       $279 = $$0356$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $$0340$i = 0;$$0345$i = $249;$$0351$i = $276;$$0357$i = $282;$$0360$i = 0;
       while(1) {
        $283 = ((($$0351$i)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($$0345$i>>>0);
        if ($287) {
         $288 = ($286|0)==(0);
         if ($288) {
          $$413$i = $$0351$i;$$434912$i = 0;$$435511$i = $$0351$i;
          label = 90;
          break L123;
         } else {
          $$1341$i = $$0351$i;$$1346$i = $286;
         }
        } else {
         $$1341$i = $$0340$i;$$1346$i = $$0345$i;
        }
        $289 = ((($$0351$i)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $$0357$i >>> 31;
        $292 = (((($$0351$i)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond1$i = $294 | $295;
        $$1361$i = $or$cond1$i ? $$0360$i : $290;
        $296 = ($293|0)==(0|0);
        $297 = $296&1;
        $298 = $297 ^ 1;
        $$0357$$i = $$0357$i << $298;
        if ($296) {
         $$2353$i = $$1361$i;$$3$i201 = $$1341$i;$$3348$i = $$1346$i;
         label = 86;
         break;
        } else {
         $$0340$i = $$1341$i;$$0345$i = $$1346$i;$$0351$i = $293;$$0357$i = $$0357$$i;$$0360$i = $$1361$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $299 = ($$2353$i|0)==(0|0);
      $300 = ($$3$i201|0)==(0|0);
      $or$cond$i = $299 & $300;
      if ($or$cond$i) {
       $301 = 2 << $$0356$i;
       $302 = (0 - ($301))|0;
       $303 = $301 | $302;
       $304 = $247 & $303;
       $305 = ($304|0)==(0);
       if ($305) {
        $$0197 = $246;
        break;
       }
       $306 = (0 - ($304))|0;
       $307 = $304 & $306;
       $308 = (($307) + -1)|0;
       $309 = $308 >>> 12;
       $310 = $309 & 16;
       $311 = $308 >>> $310;
       $312 = $311 >>> 5;
       $313 = $312 & 8;
       $314 = $313 | $310;
       $315 = $311 >>> $313;
       $316 = $315 >>> 2;
       $317 = $316 & 4;
       $318 = $314 | $317;
       $319 = $315 >>> $317;
       $320 = $319 >>> 1;
       $321 = $320 & 2;
       $322 = $318 | $321;
       $323 = $319 >>> $321;
       $324 = $323 >>> 1;
       $325 = $324 & 1;
       $326 = $322 | $325;
       $327 = $323 >>> $325;
       $328 = (($326) + ($327))|0;
       $329 = (9336 + ($328<<2)|0);
       $330 = HEAP32[$329>>2]|0;
       $$4355$ph$i = $330;
      } else {
       $$4355$ph$i = $$2353$i;
      }
      $331 = ($$4355$ph$i|0)==(0|0);
      if ($331) {
       $$4$lcssa$i = $$3$i201;$$4349$lcssa$i = $$3348$i;
      } else {
       $$413$i = $$3$i201;$$434912$i = $$3348$i;$$435511$i = $$4355$ph$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $332 = ((($$435511$i)) + 4|0);
       $333 = HEAP32[$332>>2]|0;
       $334 = $333 & -8;
       $335 = (($334) - ($246))|0;
       $336 = ($335>>>0)<($$434912$i>>>0);
       $$$4349$i = $336 ? $335 : $$434912$i;
       $$4355$$4$i = $336 ? $$435511$i : $$413$i;
       $337 = ((($$435511$i)) + 16|0);
       $338 = HEAP32[$337>>2]|0;
       $339 = ($338|0)==(0|0);
       if (!($339)) {
        $$413$i = $$4355$$4$i;$$434912$i = $$$4349$i;$$435511$i = $338;
        label = 90;
        continue;
       }
       $340 = ((($$435511$i)) + 20|0);
       $341 = HEAP32[$340>>2]|0;
       $342 = ($341|0)==(0|0);
       if ($342) {
        $$4$lcssa$i = $$4355$$4$i;$$4349$lcssa$i = $$$4349$i;
        break;
       } else {
        $$413$i = $$4355$$4$i;$$434912$i = $$$4349$i;$$435511$i = $341;
        label = 90;
       }
      }
     }
     $343 = ($$4$lcssa$i|0)==(0|0);
     if ($343) {
      $$0197 = $246;
     } else {
      $344 = HEAP32[(9040)>>2]|0;
      $345 = (($344) - ($246))|0;
      $346 = ($$4349$lcssa$i>>>0)<($345>>>0);
      if ($346) {
       $347 = HEAP32[(9048)>>2]|0;
       $348 = ($$4$lcssa$i>>>0)<($347>>>0);
       if ($348) {
        _abort();
        // unreachable;
       }
       $349 = (($$4$lcssa$i) + ($246)|0);
       $350 = ($$4$lcssa$i>>>0)<($349>>>0);
       if (!($350)) {
        _abort();
        // unreachable;
       }
       $351 = ((($$4$lcssa$i)) + 24|0);
       $352 = HEAP32[$351>>2]|0;
       $353 = ((($$4$lcssa$i)) + 12|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ($354|0)==($$4$lcssa$i|0);
       do {
        if ($355) {
         $365 = ((($$4$lcssa$i)) + 20|0);
         $366 = HEAP32[$365>>2]|0;
         $367 = ($366|0)==(0|0);
         if ($367) {
          $368 = ((($$4$lcssa$i)) + 16|0);
          $369 = HEAP32[$368>>2]|0;
          $370 = ($369|0)==(0|0);
          if ($370) {
           $$3370$i = 0;
           break;
          } else {
           $$1368$i = $369;$$1372$i = $368;
          }
         } else {
          $$1368$i = $366;$$1372$i = $365;
         }
         while(1) {
          $371 = ((($$1368$i)) + 20|0);
          $372 = HEAP32[$371>>2]|0;
          $373 = ($372|0)==(0|0);
          if (!($373)) {
           $$1368$i = $372;$$1372$i = $371;
           continue;
          }
          $374 = ((($$1368$i)) + 16|0);
          $375 = HEAP32[$374>>2]|0;
          $376 = ($375|0)==(0|0);
          if ($376) {
           break;
          } else {
           $$1368$i = $375;$$1372$i = $374;
          }
         }
         $377 = ($$1372$i>>>0)<($347>>>0);
         if ($377) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1372$i>>2] = 0;
          $$3370$i = $$1368$i;
          break;
         }
        } else {
         $356 = ((($$4$lcssa$i)) + 8|0);
         $357 = HEAP32[$356>>2]|0;
         $358 = ($357>>>0)<($347>>>0);
         if ($358) {
          _abort();
          // unreachable;
         }
         $359 = ((($357)) + 12|0);
         $360 = HEAP32[$359>>2]|0;
         $361 = ($360|0)==($$4$lcssa$i|0);
         if (!($361)) {
          _abort();
          // unreachable;
         }
         $362 = ((($354)) + 8|0);
         $363 = HEAP32[$362>>2]|0;
         $364 = ($363|0)==($$4$lcssa$i|0);
         if ($364) {
          HEAP32[$359>>2] = $354;
          HEAP32[$362>>2] = $357;
          $$3370$i = $354;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $378 = ($352|0)==(0|0);
       do {
        if ($378) {
         $470 = $247;
        } else {
         $379 = ((($$4$lcssa$i)) + 28|0);
         $380 = HEAP32[$379>>2]|0;
         $381 = (9336 + ($380<<2)|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = ($$4$lcssa$i|0)==($382|0);
         if ($383) {
          HEAP32[$381>>2] = $$3370$i;
          $cond$i204 = ($$3370$i|0)==(0|0);
          if ($cond$i204) {
           $384 = 1 << $380;
           $385 = $384 ^ -1;
           $386 = $247 & $385;
           HEAP32[(9036)>>2] = $386;
           $470 = $386;
           break;
          }
         } else {
          $387 = HEAP32[(9048)>>2]|0;
          $388 = ($352>>>0)<($387>>>0);
          if ($388) {
           _abort();
           // unreachable;
          }
          $389 = ((($352)) + 16|0);
          $390 = HEAP32[$389>>2]|0;
          $391 = ($390|0)==($$4$lcssa$i|0);
          if ($391) {
           HEAP32[$389>>2] = $$3370$i;
          } else {
           $392 = ((($352)) + 20|0);
           HEAP32[$392>>2] = $$3370$i;
          }
          $393 = ($$3370$i|0)==(0|0);
          if ($393) {
           $470 = $247;
           break;
          }
         }
         $394 = HEAP32[(9048)>>2]|0;
         $395 = ($$3370$i>>>0)<($394>>>0);
         if ($395) {
          _abort();
          // unreachable;
         }
         $396 = ((($$3370$i)) + 24|0);
         HEAP32[$396>>2] = $352;
         $397 = ((($$4$lcssa$i)) + 16|0);
         $398 = HEAP32[$397>>2]|0;
         $399 = ($398|0)==(0|0);
         do {
          if (!($399)) {
           $400 = ($398>>>0)<($394>>>0);
           if ($400) {
            _abort();
            // unreachable;
           } else {
            $401 = ((($$3370$i)) + 16|0);
            HEAP32[$401>>2] = $398;
            $402 = ((($398)) + 24|0);
            HEAP32[$402>>2] = $$3370$i;
            break;
           }
          }
         } while(0);
         $403 = ((($$4$lcssa$i)) + 20|0);
         $404 = HEAP32[$403>>2]|0;
         $405 = ($404|0)==(0|0);
         if ($405) {
          $470 = $247;
         } else {
          $406 = HEAP32[(9048)>>2]|0;
          $407 = ($404>>>0)<($406>>>0);
          if ($407) {
           _abort();
           // unreachable;
          } else {
           $408 = ((($$3370$i)) + 20|0);
           HEAP32[$408>>2] = $404;
           $409 = ((($404)) + 24|0);
           HEAP32[$409>>2] = $$3370$i;
           $470 = $247;
           break;
          }
         }
        }
       } while(0);
       $410 = ($$4349$lcssa$i>>>0)<(16);
       do {
        if ($410) {
         $411 = (($$4349$lcssa$i) + ($246))|0;
         $412 = $411 | 3;
         $413 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$413>>2] = $412;
         $414 = (($$4$lcssa$i) + ($411)|0);
         $415 = ((($414)) + 4|0);
         $416 = HEAP32[$415>>2]|0;
         $417 = $416 | 1;
         HEAP32[$415>>2] = $417;
        } else {
         $418 = $246 | 3;
         $419 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$419>>2] = $418;
         $420 = $$4349$lcssa$i | 1;
         $421 = ((($349)) + 4|0);
         HEAP32[$421>>2] = $420;
         $422 = (($349) + ($$4349$lcssa$i)|0);
         HEAP32[$422>>2] = $$4349$lcssa$i;
         $423 = $$4349$lcssa$i >>> 3;
         $424 = ($$4349$lcssa$i>>>0)<(256);
         if ($424) {
          $425 = $423 << 1;
          $426 = (9072 + ($425<<2)|0);
          $427 = HEAP32[2258]|0;
          $428 = 1 << $423;
          $429 = $427 & $428;
          $430 = ($429|0)==(0);
          if ($430) {
           $431 = $427 | $428;
           HEAP32[2258] = $431;
           $$pre$i205 = ((($426)) + 8|0);
           $$0366$i = $426;$$pre$phi$i206Z2D = $$pre$i205;
          } else {
           $432 = ((($426)) + 8|0);
           $433 = HEAP32[$432>>2]|0;
           $434 = HEAP32[(9048)>>2]|0;
           $435 = ($433>>>0)<($434>>>0);
           if ($435) {
            _abort();
            // unreachable;
           } else {
            $$0366$i = $433;$$pre$phi$i206Z2D = $432;
           }
          }
          HEAP32[$$pre$phi$i206Z2D>>2] = $349;
          $436 = ((($$0366$i)) + 12|0);
          HEAP32[$436>>2] = $349;
          $437 = ((($349)) + 8|0);
          HEAP32[$437>>2] = $$0366$i;
          $438 = ((($349)) + 12|0);
          HEAP32[$438>>2] = $426;
          break;
         }
         $439 = $$4349$lcssa$i >>> 8;
         $440 = ($439|0)==(0);
         if ($440) {
          $$0359$i = 0;
         } else {
          $441 = ($$4349$lcssa$i>>>0)>(16777215);
          if ($441) {
           $$0359$i = 31;
          } else {
           $442 = (($439) + 1048320)|0;
           $443 = $442 >>> 16;
           $444 = $443 & 8;
           $445 = $439 << $444;
           $446 = (($445) + 520192)|0;
           $447 = $446 >>> 16;
           $448 = $447 & 4;
           $449 = $448 | $444;
           $450 = $445 << $448;
           $451 = (($450) + 245760)|0;
           $452 = $451 >>> 16;
           $453 = $452 & 2;
           $454 = $449 | $453;
           $455 = (14 - ($454))|0;
           $456 = $450 << $453;
           $457 = $456 >>> 15;
           $458 = (($455) + ($457))|0;
           $459 = $458 << 1;
           $460 = (($458) + 7)|0;
           $461 = $$4349$lcssa$i >>> $460;
           $462 = $461 & 1;
           $463 = $462 | $459;
           $$0359$i = $463;
          }
         }
         $464 = (9336 + ($$0359$i<<2)|0);
         $465 = ((($349)) + 28|0);
         HEAP32[$465>>2] = $$0359$i;
         $466 = ((($349)) + 16|0);
         $467 = ((($466)) + 4|0);
         HEAP32[$467>>2] = 0;
         HEAP32[$466>>2] = 0;
         $468 = 1 << $$0359$i;
         $469 = $470 & $468;
         $471 = ($469|0)==(0);
         if ($471) {
          $472 = $470 | $468;
          HEAP32[(9036)>>2] = $472;
          HEAP32[$464>>2] = $349;
          $473 = ((($349)) + 24|0);
          HEAP32[$473>>2] = $464;
          $474 = ((($349)) + 12|0);
          HEAP32[$474>>2] = $349;
          $475 = ((($349)) + 8|0);
          HEAP32[$475>>2] = $349;
          break;
         }
         $476 = HEAP32[$464>>2]|0;
         $477 = ($$0359$i|0)==(31);
         $478 = $$0359$i >>> 1;
         $479 = (25 - ($478))|0;
         $480 = $477 ? 0 : $479;
         $481 = $$4349$lcssa$i << $480;
         $$0342$i = $481;$$0343$i = $476;
         while(1) {
          $482 = ((($$0343$i)) + 4|0);
          $483 = HEAP32[$482>>2]|0;
          $484 = $483 & -8;
          $485 = ($484|0)==($$4349$lcssa$i|0);
          if ($485) {
           label = 148;
           break;
          }
          $486 = $$0342$i >>> 31;
          $487 = (((($$0343$i)) + 16|0) + ($486<<2)|0);
          $488 = $$0342$i << 1;
          $489 = HEAP32[$487>>2]|0;
          $490 = ($489|0)==(0|0);
          if ($490) {
           label = 145;
           break;
          } else {
           $$0342$i = $488;$$0343$i = $489;
          }
         }
         if ((label|0) == 145) {
          $491 = HEAP32[(9048)>>2]|0;
          $492 = ($487>>>0)<($491>>>0);
          if ($492) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$487>>2] = $349;
           $493 = ((($349)) + 24|0);
           HEAP32[$493>>2] = $$0343$i;
           $494 = ((($349)) + 12|0);
           HEAP32[$494>>2] = $349;
           $495 = ((($349)) + 8|0);
           HEAP32[$495>>2] = $349;
           break;
          }
         }
         else if ((label|0) == 148) {
          $496 = ((($$0343$i)) + 8|0);
          $497 = HEAP32[$496>>2]|0;
          $498 = HEAP32[(9048)>>2]|0;
          $499 = ($497>>>0)>=($498>>>0);
          $not$7$i = ($$0343$i>>>0)>=($498>>>0);
          $500 = $499 & $not$7$i;
          if ($500) {
           $501 = ((($497)) + 12|0);
           HEAP32[$501>>2] = $349;
           HEAP32[$496>>2] = $349;
           $502 = ((($349)) + 8|0);
           HEAP32[$502>>2] = $497;
           $503 = ((($349)) + 12|0);
           HEAP32[$503>>2] = $$0343$i;
           $504 = ((($349)) + 24|0);
           HEAP32[$504>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $505 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $505;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $506 = HEAP32[(9040)>>2]|0;
 $507 = ($506>>>0)<($$0197>>>0);
 if (!($507)) {
  $508 = (($506) - ($$0197))|0;
  $509 = HEAP32[(9052)>>2]|0;
  $510 = ($508>>>0)>(15);
  if ($510) {
   $511 = (($509) + ($$0197)|0);
   HEAP32[(9052)>>2] = $511;
   HEAP32[(9040)>>2] = $508;
   $512 = $508 | 1;
   $513 = ((($511)) + 4|0);
   HEAP32[$513>>2] = $512;
   $514 = (($511) + ($508)|0);
   HEAP32[$514>>2] = $508;
   $515 = $$0197 | 3;
   $516 = ((($509)) + 4|0);
   HEAP32[$516>>2] = $515;
  } else {
   HEAP32[(9040)>>2] = 0;
   HEAP32[(9052)>>2] = 0;
   $517 = $506 | 3;
   $518 = ((($509)) + 4|0);
   HEAP32[$518>>2] = $517;
   $519 = (($509) + ($506)|0);
   $520 = ((($519)) + 4|0);
   $521 = HEAP32[$520>>2]|0;
   $522 = $521 | 1;
   HEAP32[$520>>2] = $522;
  }
  $523 = ((($509)) + 8|0);
  $$0 = $523;
  STACKTOP = sp;return ($$0|0);
 }
 $524 = HEAP32[(9044)>>2]|0;
 $525 = ($524>>>0)>($$0197>>>0);
 if ($525) {
  $526 = (($524) - ($$0197))|0;
  HEAP32[(9044)>>2] = $526;
  $527 = HEAP32[(9056)>>2]|0;
  $528 = (($527) + ($$0197)|0);
  HEAP32[(9056)>>2] = $528;
  $529 = $526 | 1;
  $530 = ((($528)) + 4|0);
  HEAP32[$530>>2] = $529;
  $531 = $$0197 | 3;
  $532 = ((($527)) + 4|0);
  HEAP32[$532>>2] = $531;
  $533 = ((($527)) + 8|0);
  $$0 = $533;
  STACKTOP = sp;return ($$0|0);
 }
 $534 = HEAP32[2376]|0;
 $535 = ($534|0)==(0);
 if ($535) {
  HEAP32[(9512)>>2] = 4096;
  HEAP32[(9508)>>2] = 4096;
  HEAP32[(9516)>>2] = -1;
  HEAP32[(9520)>>2] = -1;
  HEAP32[(9524)>>2] = 0;
  HEAP32[(9476)>>2] = 0;
  $536 = $1;
  $537 = $536 & -16;
  $538 = $537 ^ 1431655768;
  HEAP32[$1>>2] = $538;
  HEAP32[2376] = $538;
  $542 = 4096;
 } else {
  $$pre$i208 = HEAP32[(9512)>>2]|0;
  $542 = $$pre$i208;
 }
 $539 = (($$0197) + 48)|0;
 $540 = (($$0197) + 47)|0;
 $541 = (($542) + ($540))|0;
 $543 = (0 - ($542))|0;
 $544 = $541 & $543;
 $545 = ($544>>>0)>($$0197>>>0);
 if (!($545)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $546 = HEAP32[(9472)>>2]|0;
 $547 = ($546|0)==(0);
 if (!($547)) {
  $548 = HEAP32[(9464)>>2]|0;
  $549 = (($548) + ($544))|0;
  $550 = ($549>>>0)<=($548>>>0);
  $551 = ($549>>>0)>($546>>>0);
  $or$cond1$i210 = $550 | $551;
  if ($or$cond1$i210) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $552 = HEAP32[(9476)>>2]|0;
 $553 = $552 & 4;
 $554 = ($553|0)==(0);
 L255: do {
  if ($554) {
   $555 = HEAP32[(9056)>>2]|0;
   $556 = ($555|0)==(0|0);
   L257: do {
    if ($556) {
     label = 172;
    } else {
     $$0$i17$i = (9480);
     while(1) {
      $557 = HEAP32[$$0$i17$i>>2]|0;
      $558 = ($557>>>0)>($555>>>0);
      if (!($558)) {
       $559 = ((($$0$i17$i)) + 4|0);
       $560 = HEAP32[$559>>2]|0;
       $561 = (($557) + ($560)|0);
       $562 = ($561>>>0)>($555>>>0);
       if ($562) {
        break;
       }
      }
      $563 = ((($$0$i17$i)) + 8|0);
      $564 = HEAP32[$563>>2]|0;
      $565 = ($564|0)==(0|0);
      if ($565) {
       label = 172;
       break L257;
      } else {
       $$0$i17$i = $564;
      }
     }
     $588 = (($541) - ($524))|0;
     $589 = $588 & $543;
     $590 = ($589>>>0)<(2147483647);
     if ($590) {
      $591 = (_sbrk(($589|0))|0);
      $592 = HEAP32[$$0$i17$i>>2]|0;
      $593 = HEAP32[$559>>2]|0;
      $594 = (($592) + ($593)|0);
      $595 = ($591|0)==($594|0);
      if ($595) {
       $596 = ($591|0)==((-1)|0);
       if (!($596)) {
        $$723947$i = $589;$$748$i = $591;
        label = 190;
        break L255;
       }
      } else {
       $$2247$ph$i = $591;$$2253$ph$i = $589;
       label = 180;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 172) {
     $566 = (_sbrk(0)|0);
     $567 = ($566|0)==((-1)|0);
     if (!($567)) {
      $568 = $566;
      $569 = HEAP32[(9508)>>2]|0;
      $570 = (($569) + -1)|0;
      $571 = $570 & $568;
      $572 = ($571|0)==(0);
      $573 = (($570) + ($568))|0;
      $574 = (0 - ($569))|0;
      $575 = $573 & $574;
      $576 = (($575) - ($568))|0;
      $577 = $572 ? 0 : $576;
      $$$i = (($577) + ($544))|0;
      $578 = HEAP32[(9464)>>2]|0;
      $579 = (($$$i) + ($578))|0;
      $580 = ($$$i>>>0)>($$0197>>>0);
      $581 = ($$$i>>>0)<(2147483647);
      $or$cond$i211 = $580 & $581;
      if ($or$cond$i211) {
       $582 = HEAP32[(9472)>>2]|0;
       $583 = ($582|0)==(0);
       if (!($583)) {
        $584 = ($579>>>0)<=($578>>>0);
        $585 = ($579>>>0)>($582>>>0);
        $or$cond2$i = $584 | $585;
        if ($or$cond2$i) {
         break;
        }
       }
       $586 = (_sbrk(($$$i|0))|0);
       $587 = ($586|0)==($566|0);
       if ($587) {
        $$723947$i = $$$i;$$748$i = $566;
        label = 190;
        break L255;
       } else {
        $$2247$ph$i = $586;$$2253$ph$i = $$$i;
        label = 180;
       }
      }
     }
    }
   } while(0);
   L274: do {
    if ((label|0) == 180) {
     $597 = (0 - ($$2253$ph$i))|0;
     $598 = ($$2247$ph$i|0)!=((-1)|0);
     $599 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $599 & $598;
     $600 = ($539>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $600 & $or$cond7$i;
     do {
      if ($or$cond10$i) {
       $601 = HEAP32[(9512)>>2]|0;
       $602 = (($540) - ($$2253$ph$i))|0;
       $603 = (($602) + ($601))|0;
       $604 = (0 - ($601))|0;
       $605 = $603 & $604;
       $606 = ($605>>>0)<(2147483647);
       if ($606) {
        $607 = (_sbrk(($605|0))|0);
        $608 = ($607|0)==((-1)|0);
        if ($608) {
         (_sbrk(($597|0))|0);
         break L274;
        } else {
         $609 = (($605) + ($$2253$ph$i))|0;
         $$5256$i = $609;
         break;
        }
       } else {
        $$5256$i = $$2253$ph$i;
       }
      } else {
       $$5256$i = $$2253$ph$i;
      }
     } while(0);
     $610 = ($$2247$ph$i|0)==((-1)|0);
     if (!($610)) {
      $$723947$i = $$5256$i;$$748$i = $$2247$ph$i;
      label = 190;
      break L255;
     }
    }
   } while(0);
   $611 = HEAP32[(9476)>>2]|0;
   $612 = $611 | 4;
   HEAP32[(9476)>>2] = $612;
   label = 187;
  } else {
   label = 187;
  }
 } while(0);
 if ((label|0) == 187) {
  $613 = ($544>>>0)<(2147483647);
  if ($613) {
   $614 = (_sbrk(($544|0))|0);
   $615 = (_sbrk(0)|0);
   $616 = ($614|0)!=((-1)|0);
   $617 = ($615|0)!=((-1)|0);
   $or$cond5$i = $616 & $617;
   $618 = ($614>>>0)<($615>>>0);
   $or$cond11$i = $618 & $or$cond5$i;
   if ($or$cond11$i) {
    $619 = $615;
    $620 = $614;
    $621 = (($619) - ($620))|0;
    $622 = (($$0197) + 40)|0;
    $$not$i = ($621>>>0)>($622>>>0);
    if ($$not$i) {
     $$723947$i = $621;$$748$i = $614;
     label = 190;
    }
   }
  }
 }
 if ((label|0) == 190) {
  $623 = HEAP32[(9464)>>2]|0;
  $624 = (($623) + ($$723947$i))|0;
  HEAP32[(9464)>>2] = $624;
  $625 = HEAP32[(9468)>>2]|0;
  $626 = ($624>>>0)>($625>>>0);
  if ($626) {
   HEAP32[(9468)>>2] = $624;
  }
  $627 = HEAP32[(9056)>>2]|0;
  $628 = ($627|0)==(0|0);
  do {
   if ($628) {
    $629 = HEAP32[(9048)>>2]|0;
    $630 = ($629|0)==(0|0);
    $631 = ($$748$i>>>0)<($629>>>0);
    $or$cond12$i = $630 | $631;
    if ($or$cond12$i) {
     HEAP32[(9048)>>2] = $$748$i;
    }
    HEAP32[(9480)>>2] = $$748$i;
    HEAP32[(9484)>>2] = $$723947$i;
    HEAP32[(9492)>>2] = 0;
    $632 = HEAP32[2376]|0;
    HEAP32[(9068)>>2] = $632;
    HEAP32[(9064)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $633 = $$01$i$i << 1;
     $634 = (9072 + ($633<<2)|0);
     $635 = ((($634)) + 12|0);
     HEAP32[$635>>2] = $634;
     $636 = ((($634)) + 8|0);
     HEAP32[$636>>2] = $634;
     $637 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($637|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $637;
     }
    }
    $638 = (($$723947$i) + -40)|0;
    $639 = ((($$748$i)) + 8|0);
    $640 = $639;
    $641 = $640 & 7;
    $642 = ($641|0)==(0);
    $643 = (0 - ($640))|0;
    $644 = $643 & 7;
    $645 = $642 ? 0 : $644;
    $646 = (($$748$i) + ($645)|0);
    $647 = (($638) - ($645))|0;
    HEAP32[(9056)>>2] = $646;
    HEAP32[(9044)>>2] = $647;
    $648 = $647 | 1;
    $649 = ((($646)) + 4|0);
    HEAP32[$649>>2] = $648;
    $650 = (($646) + ($647)|0);
    $651 = ((($650)) + 4|0);
    HEAP32[$651>>2] = 40;
    $652 = HEAP32[(9520)>>2]|0;
    HEAP32[(9060)>>2] = $652;
   } else {
    $$024370$i = (9480);
    while(1) {
     $653 = HEAP32[$$024370$i>>2]|0;
     $654 = ((($$024370$i)) + 4|0);
     $655 = HEAP32[$654>>2]|0;
     $656 = (($653) + ($655)|0);
     $657 = ($$748$i|0)==($656|0);
     if ($657) {
      label = 200;
      break;
     }
     $658 = ((($$024370$i)) + 8|0);
     $659 = HEAP32[$658>>2]|0;
     $660 = ($659|0)==(0|0);
     if ($660) {
      break;
     } else {
      $$024370$i = $659;
     }
    }
    if ((label|0) == 200) {
     $661 = ((($$024370$i)) + 12|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = $662 & 8;
     $664 = ($663|0)==(0);
     if ($664) {
      $665 = ($627>>>0)>=($653>>>0);
      $666 = ($627>>>0)<($$748$i>>>0);
      $or$cond50$i = $666 & $665;
      if ($or$cond50$i) {
       $667 = (($655) + ($$723947$i))|0;
       HEAP32[$654>>2] = $667;
       $668 = HEAP32[(9044)>>2]|0;
       $669 = ((($627)) + 8|0);
       $670 = $669;
       $671 = $670 & 7;
       $672 = ($671|0)==(0);
       $673 = (0 - ($670))|0;
       $674 = $673 & 7;
       $675 = $672 ? 0 : $674;
       $676 = (($627) + ($675)|0);
       $677 = (($$723947$i) - ($675))|0;
       $678 = (($677) + ($668))|0;
       HEAP32[(9056)>>2] = $676;
       HEAP32[(9044)>>2] = $678;
       $679 = $678 | 1;
       $680 = ((($676)) + 4|0);
       HEAP32[$680>>2] = $679;
       $681 = (($676) + ($678)|0);
       $682 = ((($681)) + 4|0);
       HEAP32[$682>>2] = 40;
       $683 = HEAP32[(9520)>>2]|0;
       HEAP32[(9060)>>2] = $683;
       break;
      }
     }
    }
    $684 = HEAP32[(9048)>>2]|0;
    $685 = ($$748$i>>>0)<($684>>>0);
    if ($685) {
     HEAP32[(9048)>>2] = $$748$i;
     $749 = $$748$i;
    } else {
     $749 = $684;
    }
    $686 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (9480);
    while(1) {
     $687 = HEAP32[$$124469$i>>2]|0;
     $688 = ($687|0)==($686|0);
     if ($688) {
      label = 208;
      break;
     }
     $689 = ((($$124469$i)) + 8|0);
     $690 = HEAP32[$689>>2]|0;
     $691 = ($690|0)==(0|0);
     if ($691) {
      $$0$i$i$i = (9480);
      break;
     } else {
      $$124469$i = $690;
     }
    }
    if ((label|0) == 208) {
     $692 = ((($$124469$i)) + 12|0);
     $693 = HEAP32[$692>>2]|0;
     $694 = $693 & 8;
     $695 = ($694|0)==(0);
     if ($695) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $696 = ((($$124469$i)) + 4|0);
      $697 = HEAP32[$696>>2]|0;
      $698 = (($697) + ($$723947$i))|0;
      HEAP32[$696>>2] = $698;
      $699 = ((($$748$i)) + 8|0);
      $700 = $699;
      $701 = $700 & 7;
      $702 = ($701|0)==(0);
      $703 = (0 - ($700))|0;
      $704 = $703 & 7;
      $705 = $702 ? 0 : $704;
      $706 = (($$748$i) + ($705)|0);
      $707 = ((($686)) + 8|0);
      $708 = $707;
      $709 = $708 & 7;
      $710 = ($709|0)==(0);
      $711 = (0 - ($708))|0;
      $712 = $711 & 7;
      $713 = $710 ? 0 : $712;
      $714 = (($686) + ($713)|0);
      $715 = $714;
      $716 = $706;
      $717 = (($715) - ($716))|0;
      $718 = (($706) + ($$0197)|0);
      $719 = (($717) - ($$0197))|0;
      $720 = $$0197 | 3;
      $721 = ((($706)) + 4|0);
      HEAP32[$721>>2] = $720;
      $722 = ($714|0)==($627|0);
      do {
       if ($722) {
        $723 = HEAP32[(9044)>>2]|0;
        $724 = (($723) + ($719))|0;
        HEAP32[(9044)>>2] = $724;
        HEAP32[(9056)>>2] = $718;
        $725 = $724 | 1;
        $726 = ((($718)) + 4|0);
        HEAP32[$726>>2] = $725;
       } else {
        $727 = HEAP32[(9052)>>2]|0;
        $728 = ($714|0)==($727|0);
        if ($728) {
         $729 = HEAP32[(9040)>>2]|0;
         $730 = (($729) + ($719))|0;
         HEAP32[(9040)>>2] = $730;
         HEAP32[(9052)>>2] = $718;
         $731 = $730 | 1;
         $732 = ((($718)) + 4|0);
         HEAP32[$732>>2] = $731;
         $733 = (($718) + ($730)|0);
         HEAP32[$733>>2] = $730;
         break;
        }
        $734 = ((($714)) + 4|0);
        $735 = HEAP32[$734>>2]|0;
        $736 = $735 & 3;
        $737 = ($736|0)==(1);
        if ($737) {
         $738 = $735 & -8;
         $739 = $735 >>> 3;
         $740 = ($735>>>0)<(256);
         L326: do {
          if ($740) {
           $741 = ((($714)) + 8|0);
           $742 = HEAP32[$741>>2]|0;
           $743 = ((($714)) + 12|0);
           $744 = HEAP32[$743>>2]|0;
           $745 = $739 << 1;
           $746 = (9072 + ($745<<2)|0);
           $747 = ($742|0)==($746|0);
           do {
            if (!($747)) {
             $748 = ($742>>>0)<($749>>>0);
             if ($748) {
              _abort();
              // unreachable;
             }
             $750 = ((($742)) + 12|0);
             $751 = HEAP32[$750>>2]|0;
             $752 = ($751|0)==($714|0);
             if ($752) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $753 = ($744|0)==($742|0);
           if ($753) {
            $754 = 1 << $739;
            $755 = $754 ^ -1;
            $756 = HEAP32[2258]|0;
            $757 = $756 & $755;
            HEAP32[2258] = $757;
            break;
           }
           $758 = ($744|0)==($746|0);
           do {
            if ($758) {
             $$pre9$i$i = ((($744)) + 8|0);
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $759 = ($744>>>0)<($749>>>0);
             if ($759) {
              _abort();
              // unreachable;
             }
             $760 = ((($744)) + 8|0);
             $761 = HEAP32[$760>>2]|0;
             $762 = ($761|0)==($714|0);
             if ($762) {
              $$pre$phi10$i$iZ2D = $760;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $763 = ((($742)) + 12|0);
           HEAP32[$763>>2] = $744;
           HEAP32[$$pre$phi10$i$iZ2D>>2] = $742;
          } else {
           $764 = ((($714)) + 24|0);
           $765 = HEAP32[$764>>2]|0;
           $766 = ((($714)) + 12|0);
           $767 = HEAP32[$766>>2]|0;
           $768 = ($767|0)==($714|0);
           do {
            if ($768) {
             $778 = ((($714)) + 16|0);
             $779 = ((($778)) + 4|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==(0|0);
             if ($781) {
              $782 = HEAP32[$778>>2]|0;
              $783 = ($782|0)==(0|0);
              if ($783) {
               $$3$i$i = 0;
               break;
              } else {
               $$1290$i$i = $782;$$1292$i$i = $778;
              }
             } else {
              $$1290$i$i = $780;$$1292$i$i = $779;
             }
             while(1) {
              $784 = ((($$1290$i$i)) + 20|0);
              $785 = HEAP32[$784>>2]|0;
              $786 = ($785|0)==(0|0);
              if (!($786)) {
               $$1290$i$i = $785;$$1292$i$i = $784;
               continue;
              }
              $787 = ((($$1290$i$i)) + 16|0);
              $788 = HEAP32[$787>>2]|0;
              $789 = ($788|0)==(0|0);
              if ($789) {
               break;
              } else {
               $$1290$i$i = $788;$$1292$i$i = $787;
              }
             }
             $790 = ($$1292$i$i>>>0)<($749>>>0);
             if ($790) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1292$i$i>>2] = 0;
              $$3$i$i = $$1290$i$i;
              break;
             }
            } else {
             $769 = ((($714)) + 8|0);
             $770 = HEAP32[$769>>2]|0;
             $771 = ($770>>>0)<($749>>>0);
             if ($771) {
              _abort();
              // unreachable;
             }
             $772 = ((($770)) + 12|0);
             $773 = HEAP32[$772>>2]|0;
             $774 = ($773|0)==($714|0);
             if (!($774)) {
              _abort();
              // unreachable;
             }
             $775 = ((($767)) + 8|0);
             $776 = HEAP32[$775>>2]|0;
             $777 = ($776|0)==($714|0);
             if ($777) {
              HEAP32[$772>>2] = $767;
              HEAP32[$775>>2] = $770;
              $$3$i$i = $767;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $791 = ($765|0)==(0|0);
           if ($791) {
            break;
           }
           $792 = ((($714)) + 28|0);
           $793 = HEAP32[$792>>2]|0;
           $794 = (9336 + ($793<<2)|0);
           $795 = HEAP32[$794>>2]|0;
           $796 = ($714|0)==($795|0);
           do {
            if ($796) {
             HEAP32[$794>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $797 = 1 << $793;
             $798 = $797 ^ -1;
             $799 = HEAP32[(9036)>>2]|0;
             $800 = $799 & $798;
             HEAP32[(9036)>>2] = $800;
             break L326;
            } else {
             $801 = HEAP32[(9048)>>2]|0;
             $802 = ($765>>>0)<($801>>>0);
             if ($802) {
              _abort();
              // unreachable;
             }
             $803 = ((($765)) + 16|0);
             $804 = HEAP32[$803>>2]|0;
             $805 = ($804|0)==($714|0);
             if ($805) {
              HEAP32[$803>>2] = $$3$i$i;
             } else {
              $806 = ((($765)) + 20|0);
              HEAP32[$806>>2] = $$3$i$i;
             }
             $807 = ($$3$i$i|0)==(0|0);
             if ($807) {
              break L326;
             }
            }
           } while(0);
           $808 = HEAP32[(9048)>>2]|0;
           $809 = ($$3$i$i>>>0)<($808>>>0);
           if ($809) {
            _abort();
            // unreachable;
           }
           $810 = ((($$3$i$i)) + 24|0);
           HEAP32[$810>>2] = $765;
           $811 = ((($714)) + 16|0);
           $812 = HEAP32[$811>>2]|0;
           $813 = ($812|0)==(0|0);
           do {
            if (!($813)) {
             $814 = ($812>>>0)<($808>>>0);
             if ($814) {
              _abort();
              // unreachable;
             } else {
              $815 = ((($$3$i$i)) + 16|0);
              HEAP32[$815>>2] = $812;
              $816 = ((($812)) + 24|0);
              HEAP32[$816>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $817 = ((($811)) + 4|0);
           $818 = HEAP32[$817>>2]|0;
           $819 = ($818|0)==(0|0);
           if ($819) {
            break;
           }
           $820 = HEAP32[(9048)>>2]|0;
           $821 = ($818>>>0)<($820>>>0);
           if ($821) {
            _abort();
            // unreachable;
           } else {
            $822 = ((($$3$i$i)) + 20|0);
            HEAP32[$822>>2] = $818;
            $823 = ((($818)) + 24|0);
            HEAP32[$823>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $824 = (($714) + ($738)|0);
         $825 = (($738) + ($719))|0;
         $$0$i18$i = $824;$$0286$i$i = $825;
        } else {
         $$0$i18$i = $714;$$0286$i$i = $719;
        }
        $826 = ((($$0$i18$i)) + 4|0);
        $827 = HEAP32[$826>>2]|0;
        $828 = $827 & -2;
        HEAP32[$826>>2] = $828;
        $829 = $$0286$i$i | 1;
        $830 = ((($718)) + 4|0);
        HEAP32[$830>>2] = $829;
        $831 = (($718) + ($$0286$i$i)|0);
        HEAP32[$831>>2] = $$0286$i$i;
        $832 = $$0286$i$i >>> 3;
        $833 = ($$0286$i$i>>>0)<(256);
        if ($833) {
         $834 = $832 << 1;
         $835 = (9072 + ($834<<2)|0);
         $836 = HEAP32[2258]|0;
         $837 = 1 << $832;
         $838 = $836 & $837;
         $839 = ($838|0)==(0);
         do {
          if ($839) {
           $840 = $836 | $837;
           HEAP32[2258] = $840;
           $$pre$i19$i = ((($835)) + 8|0);
           $$0294$i$i = $835;$$pre$phi$i20$iZ2D = $$pre$i19$i;
          } else {
           $841 = ((($835)) + 8|0);
           $842 = HEAP32[$841>>2]|0;
           $843 = HEAP32[(9048)>>2]|0;
           $844 = ($842>>>0)<($843>>>0);
           if (!($844)) {
            $$0294$i$i = $842;$$pre$phi$i20$iZ2D = $841;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i20$iZ2D>>2] = $718;
         $845 = ((($$0294$i$i)) + 12|0);
         HEAP32[$845>>2] = $718;
         $846 = ((($718)) + 8|0);
         HEAP32[$846>>2] = $$0294$i$i;
         $847 = ((($718)) + 12|0);
         HEAP32[$847>>2] = $835;
         break;
        }
        $848 = $$0286$i$i >>> 8;
        $849 = ($848|0)==(0);
        do {
         if ($849) {
          $$0295$i$i = 0;
         } else {
          $850 = ($$0286$i$i>>>0)>(16777215);
          if ($850) {
           $$0295$i$i = 31;
           break;
          }
          $851 = (($848) + 1048320)|0;
          $852 = $851 >>> 16;
          $853 = $852 & 8;
          $854 = $848 << $853;
          $855 = (($854) + 520192)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 4;
          $858 = $857 | $853;
          $859 = $854 << $857;
          $860 = (($859) + 245760)|0;
          $861 = $860 >>> 16;
          $862 = $861 & 2;
          $863 = $858 | $862;
          $864 = (14 - ($863))|0;
          $865 = $859 << $862;
          $866 = $865 >>> 15;
          $867 = (($864) + ($866))|0;
          $868 = $867 << 1;
          $869 = (($867) + 7)|0;
          $870 = $$0286$i$i >>> $869;
          $871 = $870 & 1;
          $872 = $871 | $868;
          $$0295$i$i = $872;
         }
        } while(0);
        $873 = (9336 + ($$0295$i$i<<2)|0);
        $874 = ((($718)) + 28|0);
        HEAP32[$874>>2] = $$0295$i$i;
        $875 = ((($718)) + 16|0);
        $876 = ((($875)) + 4|0);
        HEAP32[$876>>2] = 0;
        HEAP32[$875>>2] = 0;
        $877 = HEAP32[(9036)>>2]|0;
        $878 = 1 << $$0295$i$i;
        $879 = $877 & $878;
        $880 = ($879|0)==(0);
        if ($880) {
         $881 = $877 | $878;
         HEAP32[(9036)>>2] = $881;
         HEAP32[$873>>2] = $718;
         $882 = ((($718)) + 24|0);
         HEAP32[$882>>2] = $873;
         $883 = ((($718)) + 12|0);
         HEAP32[$883>>2] = $718;
         $884 = ((($718)) + 8|0);
         HEAP32[$884>>2] = $718;
         break;
        }
        $885 = HEAP32[$873>>2]|0;
        $886 = ($$0295$i$i|0)==(31);
        $887 = $$0295$i$i >>> 1;
        $888 = (25 - ($887))|0;
        $889 = $886 ? 0 : $888;
        $890 = $$0286$i$i << $889;
        $$0287$i$i = $890;$$0288$i$i = $885;
        while(1) {
         $891 = ((($$0288$i$i)) + 4|0);
         $892 = HEAP32[$891>>2]|0;
         $893 = $892 & -8;
         $894 = ($893|0)==($$0286$i$i|0);
         if ($894) {
          label = 278;
          break;
         }
         $895 = $$0287$i$i >>> 31;
         $896 = (((($$0288$i$i)) + 16|0) + ($895<<2)|0);
         $897 = $$0287$i$i << 1;
         $898 = HEAP32[$896>>2]|0;
         $899 = ($898|0)==(0|0);
         if ($899) {
          label = 275;
          break;
         } else {
          $$0287$i$i = $897;$$0288$i$i = $898;
         }
        }
        if ((label|0) == 275) {
         $900 = HEAP32[(9048)>>2]|0;
         $901 = ($896>>>0)<($900>>>0);
         if ($901) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$896>>2] = $718;
          $902 = ((($718)) + 24|0);
          HEAP32[$902>>2] = $$0288$i$i;
          $903 = ((($718)) + 12|0);
          HEAP32[$903>>2] = $718;
          $904 = ((($718)) + 8|0);
          HEAP32[$904>>2] = $718;
          break;
         }
        }
        else if ((label|0) == 278) {
         $905 = ((($$0288$i$i)) + 8|0);
         $906 = HEAP32[$905>>2]|0;
         $907 = HEAP32[(9048)>>2]|0;
         $908 = ($906>>>0)>=($907>>>0);
         $not$$i22$i = ($$0288$i$i>>>0)>=($907>>>0);
         $909 = $908 & $not$$i22$i;
         if ($909) {
          $910 = ((($906)) + 12|0);
          HEAP32[$910>>2] = $718;
          HEAP32[$905>>2] = $718;
          $911 = ((($718)) + 8|0);
          HEAP32[$911>>2] = $906;
          $912 = ((($718)) + 12|0);
          HEAP32[$912>>2] = $$0288$i$i;
          $913 = ((($718)) + 24|0);
          HEAP32[$913>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1044 = ((($706)) + 8|0);
      $$0 = $1044;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0$i$i$i = (9480);
     }
    }
    while(1) {
     $914 = HEAP32[$$0$i$i$i>>2]|0;
     $915 = ($914>>>0)>($627>>>0);
     if (!($915)) {
      $916 = ((($$0$i$i$i)) + 4|0);
      $917 = HEAP32[$916>>2]|0;
      $918 = (($914) + ($917)|0);
      $919 = ($918>>>0)>($627>>>0);
      if ($919) {
       break;
      }
     }
     $920 = ((($$0$i$i$i)) + 8|0);
     $921 = HEAP32[$920>>2]|0;
     $$0$i$i$i = $921;
    }
    $922 = ((($918)) + -47|0);
    $923 = ((($922)) + 8|0);
    $924 = $923;
    $925 = $924 & 7;
    $926 = ($925|0)==(0);
    $927 = (0 - ($924))|0;
    $928 = $927 & 7;
    $929 = $926 ? 0 : $928;
    $930 = (($922) + ($929)|0);
    $931 = ((($627)) + 16|0);
    $932 = ($930>>>0)<($931>>>0);
    $933 = $932 ? $627 : $930;
    $934 = ((($933)) + 8|0);
    $935 = ((($933)) + 24|0);
    $936 = (($$723947$i) + -40)|0;
    $937 = ((($$748$i)) + 8|0);
    $938 = $937;
    $939 = $938 & 7;
    $940 = ($939|0)==(0);
    $941 = (0 - ($938))|0;
    $942 = $941 & 7;
    $943 = $940 ? 0 : $942;
    $944 = (($$748$i) + ($943)|0);
    $945 = (($936) - ($943))|0;
    HEAP32[(9056)>>2] = $944;
    HEAP32[(9044)>>2] = $945;
    $946 = $945 | 1;
    $947 = ((($944)) + 4|0);
    HEAP32[$947>>2] = $946;
    $948 = (($944) + ($945)|0);
    $949 = ((($948)) + 4|0);
    HEAP32[$949>>2] = 40;
    $950 = HEAP32[(9520)>>2]|0;
    HEAP32[(9060)>>2] = $950;
    $951 = ((($933)) + 4|0);
    HEAP32[$951>>2] = 27;
    ;HEAP32[$934>>2]=HEAP32[(9480)>>2]|0;HEAP32[$934+4>>2]=HEAP32[(9480)+4>>2]|0;HEAP32[$934+8>>2]=HEAP32[(9480)+8>>2]|0;HEAP32[$934+12>>2]=HEAP32[(9480)+12>>2]|0;
    HEAP32[(9480)>>2] = $$748$i;
    HEAP32[(9484)>>2] = $$723947$i;
    HEAP32[(9492)>>2] = 0;
    HEAP32[(9488)>>2] = $934;
    $$0$i$i = $935;
    while(1) {
     $952 = ((($$0$i$i)) + 4|0);
     HEAP32[$952>>2] = 7;
     $953 = ((($952)) + 4|0);
     $954 = ($953>>>0)<($918>>>0);
     if ($954) {
      $$0$i$i = $952;
     } else {
      break;
     }
    }
    $955 = ($933|0)==($627|0);
    if (!($955)) {
     $956 = $933;
     $957 = $627;
     $958 = (($956) - ($957))|0;
     $959 = HEAP32[$951>>2]|0;
     $960 = $959 & -2;
     HEAP32[$951>>2] = $960;
     $961 = $958 | 1;
     $962 = ((($627)) + 4|0);
     HEAP32[$962>>2] = $961;
     HEAP32[$933>>2] = $958;
     $963 = $958 >>> 3;
     $964 = ($958>>>0)<(256);
     if ($964) {
      $965 = $963 << 1;
      $966 = (9072 + ($965<<2)|0);
      $967 = HEAP32[2258]|0;
      $968 = 1 << $963;
      $969 = $967 & $968;
      $970 = ($969|0)==(0);
      if ($970) {
       $971 = $967 | $968;
       HEAP32[2258] = $971;
       $$pre$i$i = ((($966)) + 8|0);
       $$0211$i$i = $966;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $972 = ((($966)) + 8|0);
       $973 = HEAP32[$972>>2]|0;
       $974 = HEAP32[(9048)>>2]|0;
       $975 = ($973>>>0)<($974>>>0);
       if ($975) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $973;$$pre$phi$i$iZ2D = $972;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $627;
      $976 = ((($$0211$i$i)) + 12|0);
      HEAP32[$976>>2] = $627;
      $977 = ((($627)) + 8|0);
      HEAP32[$977>>2] = $$0211$i$i;
      $978 = ((($627)) + 12|0);
      HEAP32[$978>>2] = $966;
      break;
     }
     $979 = $958 >>> 8;
     $980 = ($979|0)==(0);
     if ($980) {
      $$0212$i$i = 0;
     } else {
      $981 = ($958>>>0)>(16777215);
      if ($981) {
       $$0212$i$i = 31;
      } else {
       $982 = (($979) + 1048320)|0;
       $983 = $982 >>> 16;
       $984 = $983 & 8;
       $985 = $979 << $984;
       $986 = (($985) + 520192)|0;
       $987 = $986 >>> 16;
       $988 = $987 & 4;
       $989 = $988 | $984;
       $990 = $985 << $988;
       $991 = (($990) + 245760)|0;
       $992 = $991 >>> 16;
       $993 = $992 & 2;
       $994 = $989 | $993;
       $995 = (14 - ($994))|0;
       $996 = $990 << $993;
       $997 = $996 >>> 15;
       $998 = (($995) + ($997))|0;
       $999 = $998 << 1;
       $1000 = (($998) + 7)|0;
       $1001 = $958 >>> $1000;
       $1002 = $1001 & 1;
       $1003 = $1002 | $999;
       $$0212$i$i = $1003;
      }
     }
     $1004 = (9336 + ($$0212$i$i<<2)|0);
     $1005 = ((($627)) + 28|0);
     HEAP32[$1005>>2] = $$0212$i$i;
     $1006 = ((($627)) + 20|0);
     HEAP32[$1006>>2] = 0;
     HEAP32[$931>>2] = 0;
     $1007 = HEAP32[(9036)>>2]|0;
     $1008 = 1 << $$0212$i$i;
     $1009 = $1007 & $1008;
     $1010 = ($1009|0)==(0);
     if ($1010) {
      $1011 = $1007 | $1008;
      HEAP32[(9036)>>2] = $1011;
      HEAP32[$1004>>2] = $627;
      $1012 = ((($627)) + 24|0);
      HEAP32[$1012>>2] = $1004;
      $1013 = ((($627)) + 12|0);
      HEAP32[$1013>>2] = $627;
      $1014 = ((($627)) + 8|0);
      HEAP32[$1014>>2] = $627;
      break;
     }
     $1015 = HEAP32[$1004>>2]|0;
     $1016 = ($$0212$i$i|0)==(31);
     $1017 = $$0212$i$i >>> 1;
     $1018 = (25 - ($1017))|0;
     $1019 = $1016 ? 0 : $1018;
     $1020 = $958 << $1019;
     $$0206$i$i = $1020;$$0207$i$i = $1015;
     while(1) {
      $1021 = ((($$0207$i$i)) + 4|0);
      $1022 = HEAP32[$1021>>2]|0;
      $1023 = $1022 & -8;
      $1024 = ($1023|0)==($958|0);
      if ($1024) {
       label = 304;
       break;
      }
      $1025 = $$0206$i$i >>> 31;
      $1026 = (((($$0207$i$i)) + 16|0) + ($1025<<2)|0);
      $1027 = $$0206$i$i << 1;
      $1028 = HEAP32[$1026>>2]|0;
      $1029 = ($1028|0)==(0|0);
      if ($1029) {
       label = 301;
       break;
      } else {
       $$0206$i$i = $1027;$$0207$i$i = $1028;
      }
     }
     if ((label|0) == 301) {
      $1030 = HEAP32[(9048)>>2]|0;
      $1031 = ($1026>>>0)<($1030>>>0);
      if ($1031) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$1026>>2] = $627;
       $1032 = ((($627)) + 24|0);
       HEAP32[$1032>>2] = $$0207$i$i;
       $1033 = ((($627)) + 12|0);
       HEAP32[$1033>>2] = $627;
       $1034 = ((($627)) + 8|0);
       HEAP32[$1034>>2] = $627;
       break;
      }
     }
     else if ((label|0) == 304) {
      $1035 = ((($$0207$i$i)) + 8|0);
      $1036 = HEAP32[$1035>>2]|0;
      $1037 = HEAP32[(9048)>>2]|0;
      $1038 = ($1036>>>0)>=($1037>>>0);
      $not$$i$i = ($$0207$i$i>>>0)>=($1037>>>0);
      $1039 = $1038 & $not$$i$i;
      if ($1039) {
       $1040 = ((($1036)) + 12|0);
       HEAP32[$1040>>2] = $627;
       HEAP32[$1035>>2] = $627;
       $1041 = ((($627)) + 8|0);
       HEAP32[$1041>>2] = $1036;
       $1042 = ((($627)) + 12|0);
       HEAP32[$1042>>2] = $$0207$i$i;
       $1043 = ((($627)) + 24|0);
       HEAP32[$1043>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1045 = HEAP32[(9044)>>2]|0;
  $1046 = ($1045>>>0)>($$0197>>>0);
  if ($1046) {
   $1047 = (($1045) - ($$0197))|0;
   HEAP32[(9044)>>2] = $1047;
   $1048 = HEAP32[(9056)>>2]|0;
   $1049 = (($1048) + ($$0197)|0);
   HEAP32[(9056)>>2] = $1049;
   $1050 = $1047 | 1;
   $1051 = ((($1049)) + 4|0);
   HEAP32[$1051>>2] = $1050;
   $1052 = $$0197 | 3;
   $1053 = ((($1048)) + 4|0);
   HEAP32[$1053>>2] = $1052;
   $1054 = ((($1048)) + 8|0);
   $$0 = $1054;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1055 = (___errno_location()|0);
 HEAP32[$1055>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381 = 0, $$0382 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1388 = 0, $$1396 = 0, $$1400 = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre = 0, $$pre$phi439Z2D = 0, $$pre$phi441Z2D = 0, $$pre$phiZ2D = 0, $$pre438 = 0;
 var $$pre440 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $cond418 = 0, $cond419 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(9048)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(9052)>>2]|0;
   $20 = ($16|0)==($19|0);
   if ($20) {
    $105 = ((($10)) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = $106 & 3;
    $108 = ($107|0)==(3);
    if (!($108)) {
     $$1 = $16;$$1380 = $17;
     break;
    }
    HEAP32[(9040)>>2] = $17;
    $109 = $106 & -2;
    HEAP32[$105>>2] = $109;
    $110 = $17 | 1;
    $111 = ((($16)) + 4|0);
    HEAP32[$111>>2] = $110;
    $112 = (($16) + ($17)|0);
    HEAP32[$112>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (9072 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($24>>>0)<($3>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[2258]|0;
     $38 = $37 & $36;
     HEAP32[2258] = $38;
     $$1 = $16;$$1380 = $17;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre440 = ((($26)) + 8|0);
     $$pre$phi441Z2D = $$pre440;
    } else {
     $40 = ($26>>>0)<($3>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi441Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi441Z2D>>2] = $24;
    $$1 = $16;$$1380 = $17;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1385 = $63;$$1388 = $59;
      }
     } else {
      $$1385 = $61;$$1388 = $60;
     }
     while(1) {
      $65 = ((($$1385)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if (!($67)) {
       $$1385 = $66;$$1388 = $65;
       continue;
      }
      $68 = ((($$1385)) + 16|0);
      $69 = HEAP32[$68>>2]|0;
      $70 = ($69|0)==(0|0);
      if ($70) {
       break;
      } else {
       $$1385 = $69;$$1388 = $68;
      }
     }
     $71 = ($$1388>>>0)<($3>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1388>>2] = 0;
      $$3 = $$1385;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51>>>0)<($3>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1380 = $17;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (9336 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($16|0)==($76|0);
    if ($77) {
     HEAP32[$75>>2] = $$3;
     $cond418 = ($$3|0)==(0|0);
     if ($cond418) {
      $78 = 1 << $74;
      $79 = $78 ^ -1;
      $80 = HEAP32[(9036)>>2]|0;
      $81 = $80 & $79;
      HEAP32[(9036)>>2] = $81;
      $$1 = $16;$$1380 = $17;
      break;
     }
    } else {
     $82 = HEAP32[(9048)>>2]|0;
     $83 = ($46>>>0)<($82>>>0);
     if ($83) {
      _abort();
      // unreachable;
     }
     $84 = ((($46)) + 16|0);
     $85 = HEAP32[$84>>2]|0;
     $86 = ($85|0)==($16|0);
     if ($86) {
      HEAP32[$84>>2] = $$3;
     } else {
      $87 = ((($46)) + 20|0);
      HEAP32[$87>>2] = $$3;
     }
     $88 = ($$3|0)==(0|0);
     if ($88) {
      $$1 = $16;$$1380 = $17;
      break;
     }
    }
    $89 = HEAP32[(9048)>>2]|0;
    $90 = ($$3>>>0)<($89>>>0);
    if ($90) {
     _abort();
     // unreachable;
    }
    $91 = ((($$3)) + 24|0);
    HEAP32[$91>>2] = $46;
    $92 = ((($16)) + 16|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    do {
     if (!($94)) {
      $95 = ($93>>>0)<($89>>>0);
      if ($95) {
       _abort();
       // unreachable;
      } else {
       $96 = ((($$3)) + 16|0);
       HEAP32[$96>>2] = $93;
       $97 = ((($93)) + 24|0);
       HEAP32[$97>>2] = $$3;
       break;
      }
     }
    } while(0);
    $98 = ((($92)) + 4|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ($99|0)==(0|0);
    if ($100) {
     $$1 = $16;$$1380 = $17;
    } else {
     $101 = HEAP32[(9048)>>2]|0;
     $102 = ($99>>>0)<($101>>>0);
     if ($102) {
      _abort();
      // unreachable;
     } else {
      $103 = ((($$3)) + 20|0);
      HEAP32[$103>>2] = $99;
      $104 = ((($99)) + 24|0);
      HEAP32[$104>>2] = $$3;
      $$1 = $16;$$1380 = $17;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1380 = $9;
  }
 } while(0);
 $113 = ($$1>>>0)<($10>>>0);
 if (!($113)) {
  _abort();
  // unreachable;
 }
 $114 = ((($10)) + 4|0);
 $115 = HEAP32[$114>>2]|0;
 $116 = $115 & 1;
 $117 = ($116|0)==(0);
 if ($117) {
  _abort();
  // unreachable;
 }
 $118 = $115 & 2;
 $119 = ($118|0)==(0);
 if ($119) {
  $120 = HEAP32[(9056)>>2]|0;
  $121 = ($10|0)==($120|0);
  if ($121) {
   $122 = HEAP32[(9044)>>2]|0;
   $123 = (($122) + ($$1380))|0;
   HEAP32[(9044)>>2] = $123;
   HEAP32[(9056)>>2] = $$1;
   $124 = $123 | 1;
   $125 = ((($$1)) + 4|0);
   HEAP32[$125>>2] = $124;
   $126 = HEAP32[(9052)>>2]|0;
   $127 = ($$1|0)==($126|0);
   if (!($127)) {
    return;
   }
   HEAP32[(9052)>>2] = 0;
   HEAP32[(9040)>>2] = 0;
   return;
  }
  $128 = HEAP32[(9052)>>2]|0;
  $129 = ($10|0)==($128|0);
  if ($129) {
   $130 = HEAP32[(9040)>>2]|0;
   $131 = (($130) + ($$1380))|0;
   HEAP32[(9040)>>2] = $131;
   HEAP32[(9052)>>2] = $$1;
   $132 = $131 | 1;
   $133 = ((($$1)) + 4|0);
   HEAP32[$133>>2] = $132;
   $134 = (($$1) + ($131)|0);
   HEAP32[$134>>2] = $131;
   return;
  }
  $135 = $115 & -8;
  $136 = (($135) + ($$1380))|0;
  $137 = $115 >>> 3;
  $138 = ($115>>>0)<(256);
  do {
   if ($138) {
    $139 = ((($10)) + 8|0);
    $140 = HEAP32[$139>>2]|0;
    $141 = ((($10)) + 12|0);
    $142 = HEAP32[$141>>2]|0;
    $143 = $137 << 1;
    $144 = (9072 + ($143<<2)|0);
    $145 = ($140|0)==($144|0);
    if (!($145)) {
     $146 = HEAP32[(9048)>>2]|0;
     $147 = ($140>>>0)<($146>>>0);
     if ($147) {
      _abort();
      // unreachable;
     }
     $148 = ((($140)) + 12|0);
     $149 = HEAP32[$148>>2]|0;
     $150 = ($149|0)==($10|0);
     if (!($150)) {
      _abort();
      // unreachable;
     }
    }
    $151 = ($142|0)==($140|0);
    if ($151) {
     $152 = 1 << $137;
     $153 = $152 ^ -1;
     $154 = HEAP32[2258]|0;
     $155 = $154 & $153;
     HEAP32[2258] = $155;
     break;
    }
    $156 = ($142|0)==($144|0);
    if ($156) {
     $$pre438 = ((($142)) + 8|0);
     $$pre$phi439Z2D = $$pre438;
    } else {
     $157 = HEAP32[(9048)>>2]|0;
     $158 = ($142>>>0)<($157>>>0);
     if ($158) {
      _abort();
      // unreachable;
     }
     $159 = ((($142)) + 8|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==($10|0);
     if ($161) {
      $$pre$phi439Z2D = $159;
     } else {
      _abort();
      // unreachable;
     }
    }
    $162 = ((($140)) + 12|0);
    HEAP32[$162>>2] = $142;
    HEAP32[$$pre$phi439Z2D>>2] = $140;
   } else {
    $163 = ((($10)) + 24|0);
    $164 = HEAP32[$163>>2]|0;
    $165 = ((($10)) + 12|0);
    $166 = HEAP32[$165>>2]|0;
    $167 = ($166|0)==($10|0);
    do {
     if ($167) {
      $178 = ((($10)) + 16|0);
      $179 = ((($178)) + 4|0);
      $180 = HEAP32[$179>>2]|0;
      $181 = ($180|0)==(0|0);
      if ($181) {
       $182 = HEAP32[$178>>2]|0;
       $183 = ($182|0)==(0|0);
       if ($183) {
        $$3398 = 0;
        break;
       } else {
        $$1396 = $182;$$1400 = $178;
       }
      } else {
       $$1396 = $180;$$1400 = $179;
      }
      while(1) {
       $184 = ((($$1396)) + 20|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($185|0)==(0|0);
       if (!($186)) {
        $$1396 = $185;$$1400 = $184;
        continue;
       }
       $187 = ((($$1396)) + 16|0);
       $188 = HEAP32[$187>>2]|0;
       $189 = ($188|0)==(0|0);
       if ($189) {
        break;
       } else {
        $$1396 = $188;$$1400 = $187;
       }
      }
      $190 = HEAP32[(9048)>>2]|0;
      $191 = ($$1400>>>0)<($190>>>0);
      if ($191) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1400>>2] = 0;
       $$3398 = $$1396;
       break;
      }
     } else {
      $168 = ((($10)) + 8|0);
      $169 = HEAP32[$168>>2]|0;
      $170 = HEAP32[(9048)>>2]|0;
      $171 = ($169>>>0)<($170>>>0);
      if ($171) {
       _abort();
       // unreachable;
      }
      $172 = ((($169)) + 12|0);
      $173 = HEAP32[$172>>2]|0;
      $174 = ($173|0)==($10|0);
      if (!($174)) {
       _abort();
       // unreachable;
      }
      $175 = ((($166)) + 8|0);
      $176 = HEAP32[$175>>2]|0;
      $177 = ($176|0)==($10|0);
      if ($177) {
       HEAP32[$172>>2] = $166;
       HEAP32[$175>>2] = $169;
       $$3398 = $166;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $192 = ($164|0)==(0|0);
    if (!($192)) {
     $193 = ((($10)) + 28|0);
     $194 = HEAP32[$193>>2]|0;
     $195 = (9336 + ($194<<2)|0);
     $196 = HEAP32[$195>>2]|0;
     $197 = ($10|0)==($196|0);
     if ($197) {
      HEAP32[$195>>2] = $$3398;
      $cond419 = ($$3398|0)==(0|0);
      if ($cond419) {
       $198 = 1 << $194;
       $199 = $198 ^ -1;
       $200 = HEAP32[(9036)>>2]|0;
       $201 = $200 & $199;
       HEAP32[(9036)>>2] = $201;
       break;
      }
     } else {
      $202 = HEAP32[(9048)>>2]|0;
      $203 = ($164>>>0)<($202>>>0);
      if ($203) {
       _abort();
       // unreachable;
      }
      $204 = ((($164)) + 16|0);
      $205 = HEAP32[$204>>2]|0;
      $206 = ($205|0)==($10|0);
      if ($206) {
       HEAP32[$204>>2] = $$3398;
      } else {
       $207 = ((($164)) + 20|0);
       HEAP32[$207>>2] = $$3398;
      }
      $208 = ($$3398|0)==(0|0);
      if ($208) {
       break;
      }
     }
     $209 = HEAP32[(9048)>>2]|0;
     $210 = ($$3398>>>0)<($209>>>0);
     if ($210) {
      _abort();
      // unreachable;
     }
     $211 = ((($$3398)) + 24|0);
     HEAP32[$211>>2] = $164;
     $212 = ((($10)) + 16|0);
     $213 = HEAP32[$212>>2]|0;
     $214 = ($213|0)==(0|0);
     do {
      if (!($214)) {
       $215 = ($213>>>0)<($209>>>0);
       if ($215) {
        _abort();
        // unreachable;
       } else {
        $216 = ((($$3398)) + 16|0);
        HEAP32[$216>>2] = $213;
        $217 = ((($213)) + 24|0);
        HEAP32[$217>>2] = $$3398;
        break;
       }
      }
     } while(0);
     $218 = ((($212)) + 4|0);
     $219 = HEAP32[$218>>2]|0;
     $220 = ($219|0)==(0|0);
     if (!($220)) {
      $221 = HEAP32[(9048)>>2]|0;
      $222 = ($219>>>0)<($221>>>0);
      if ($222) {
       _abort();
       // unreachable;
      } else {
       $223 = ((($$3398)) + 20|0);
       HEAP32[$223>>2] = $219;
       $224 = ((($219)) + 24|0);
       HEAP32[$224>>2] = $$3398;
       break;
      }
     }
    }
   }
  } while(0);
  $225 = $136 | 1;
  $226 = ((($$1)) + 4|0);
  HEAP32[$226>>2] = $225;
  $227 = (($$1) + ($136)|0);
  HEAP32[$227>>2] = $136;
  $228 = HEAP32[(9052)>>2]|0;
  $229 = ($$1|0)==($228|0);
  if ($229) {
   HEAP32[(9040)>>2] = $136;
   return;
  } else {
   $$2 = $136;
  }
 } else {
  $230 = $115 & -2;
  HEAP32[$114>>2] = $230;
  $231 = $$1380 | 1;
  $232 = ((($$1)) + 4|0);
  HEAP32[$232>>2] = $231;
  $233 = (($$1) + ($$1380)|0);
  HEAP32[$233>>2] = $$1380;
  $$2 = $$1380;
 }
 $234 = $$2 >>> 3;
 $235 = ($$2>>>0)<(256);
 if ($235) {
  $236 = $234 << 1;
  $237 = (9072 + ($236<<2)|0);
  $238 = HEAP32[2258]|0;
  $239 = 1 << $234;
  $240 = $238 & $239;
  $241 = ($240|0)==(0);
  if ($241) {
   $242 = $238 | $239;
   HEAP32[2258] = $242;
   $$pre = ((($237)) + 8|0);
   $$0401 = $237;$$pre$phiZ2D = $$pre;
  } else {
   $243 = ((($237)) + 8|0);
   $244 = HEAP32[$243>>2]|0;
   $245 = HEAP32[(9048)>>2]|0;
   $246 = ($244>>>0)<($245>>>0);
   if ($246) {
    _abort();
    // unreachable;
   } else {
    $$0401 = $244;$$pre$phiZ2D = $243;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $247 = ((($$0401)) + 12|0);
  HEAP32[$247>>2] = $$1;
  $248 = ((($$1)) + 8|0);
  HEAP32[$248>>2] = $$0401;
  $249 = ((($$1)) + 12|0);
  HEAP32[$249>>2] = $237;
  return;
 }
 $250 = $$2 >>> 8;
 $251 = ($250|0)==(0);
 if ($251) {
  $$0394 = 0;
 } else {
  $252 = ($$2>>>0)>(16777215);
  if ($252) {
   $$0394 = 31;
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
   $272 = $$2 >>> $271;
   $273 = $272 & 1;
   $274 = $273 | $270;
   $$0394 = $274;
  }
 }
 $275 = (9336 + ($$0394<<2)|0);
 $276 = ((($$1)) + 28|0);
 HEAP32[$276>>2] = $$0394;
 $277 = ((($$1)) + 16|0);
 $278 = ((($$1)) + 20|0);
 HEAP32[$278>>2] = 0;
 HEAP32[$277>>2] = 0;
 $279 = HEAP32[(9036)>>2]|0;
 $280 = 1 << $$0394;
 $281 = $279 & $280;
 $282 = ($281|0)==(0);
 do {
  if ($282) {
   $283 = $279 | $280;
   HEAP32[(9036)>>2] = $283;
   HEAP32[$275>>2] = $$1;
   $284 = ((($$1)) + 24|0);
   HEAP32[$284>>2] = $275;
   $285 = ((($$1)) + 12|0);
   HEAP32[$285>>2] = $$1;
   $286 = ((($$1)) + 8|0);
   HEAP32[$286>>2] = $$1;
  } else {
   $287 = HEAP32[$275>>2]|0;
   $288 = ($$0394|0)==(31);
   $289 = $$0394 >>> 1;
   $290 = (25 - ($289))|0;
   $291 = $288 ? 0 : $290;
   $292 = $$2 << $291;
   $$0381 = $292;$$0382 = $287;
   while(1) {
    $293 = ((($$0382)) + 4|0);
    $294 = HEAP32[$293>>2]|0;
    $295 = $294 & -8;
    $296 = ($295|0)==($$2|0);
    if ($296) {
     label = 130;
     break;
    }
    $297 = $$0381 >>> 31;
    $298 = (((($$0382)) + 16|0) + ($297<<2)|0);
    $299 = $$0381 << 1;
    $300 = HEAP32[$298>>2]|0;
    $301 = ($300|0)==(0|0);
    if ($301) {
     label = 127;
     break;
    } else {
     $$0381 = $299;$$0382 = $300;
    }
   }
   if ((label|0) == 127) {
    $302 = HEAP32[(9048)>>2]|0;
    $303 = ($298>>>0)<($302>>>0);
    if ($303) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$298>>2] = $$1;
     $304 = ((($$1)) + 24|0);
     HEAP32[$304>>2] = $$0382;
     $305 = ((($$1)) + 12|0);
     HEAP32[$305>>2] = $$1;
     $306 = ((($$1)) + 8|0);
     HEAP32[$306>>2] = $$1;
     break;
    }
   }
   else if ((label|0) == 130) {
    $307 = ((($$0382)) + 8|0);
    $308 = HEAP32[$307>>2]|0;
    $309 = HEAP32[(9048)>>2]|0;
    $310 = ($308>>>0)>=($309>>>0);
    $not$ = ($$0382>>>0)>=($309>>>0);
    $311 = $310 & $not$;
    if ($311) {
     $312 = ((($308)) + 12|0);
     HEAP32[$312>>2] = $$1;
     HEAP32[$307>>2] = $$1;
     $313 = ((($$1)) + 8|0);
     HEAP32[$313>>2] = $308;
     $314 = ((($$1)) + 12|0);
     HEAP32[$314>>2] = $$0382;
     $315 = ((($$1)) + 24|0);
     HEAP32[$315>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $316 = HEAP32[(9064)>>2]|0;
 $317 = (($316) + -1)|0;
 HEAP32[(9064)>>2] = $317;
 $318 = ($317|0)==(0);
 if ($318) {
  $$0211$in$i = (9488);
 } else {
  return;
 }
 while(1) {
  $$0211$i = HEAP32[$$0211$in$i>>2]|0;
  $319 = ($$0211$i|0)==(0|0);
  $320 = ((($$0211$i)) + 8|0);
  if ($319) {
   break;
  } else {
   $$0211$in$i = $320;
  }
 }
 HEAP32[(9064)>>2] = -1;
 return;
}
function _calloc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = Math_imul($1, $0)|0;
  $4 = $1 | $0;
  $5 = ($4>>>0)>(65535);
  if ($5) {
   $6 = (($3>>>0) / ($0>>>0))&-1;
   $7 = ($6|0)==($1|0);
   $$ = $7 ? $3 : -1;
   $$0 = $$;
  } else {
   $$0 = $3;
  }
 }
 $8 = (_malloc($$0)|0);
 $9 = ($8|0)==(0|0);
 if ($9) {
  return ($8|0);
 }
 $10 = ((($8)) + -4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = $11 & 3;
 $13 = ($12|0)==(0);
 if ($13) {
  return ($8|0);
 }
 _memset(($8|0),0,($$0|0))|0;
 return ($8|0);
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
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        ___setErrNo(12);
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        return -1;
      }
    }
    return oldDynamicTop|0;
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
function _pthread_self() {
    return 0;
}
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

  return { ___muldsi3: ___muldsi3, _sbrk: _sbrk, _rlwejs_secret_alice: _rlwejs_secret_alice, _bitshift64Ashr: _bitshift64Ashr, _free: _free, _rlwejs_private_key_bytes: _rlwejs_private_key_bytes, _i64Add: _i64Add, _pthread_self: _pthread_self, _i64Subtract: _i64Subtract, _rlwejs_secret_bytes: _rlwejs_secret_bytes, _malloc: _malloc, _rlwejs_keypair_alice: _rlwejs_keypair_alice, _memcpy: _memcpy, _rlwejs_init: _rlwejs_init, ___muldi3: ___muldi3, _rlwejs_public_key_bytes: _rlwejs_public_key_bytes, _memset: _memset, _rlwejs_secret_bob: _rlwejs_secret_bob, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiiiiiii: dynCall_iiiiiiii, dynCall_iiiiii: dynCall_iiiiii, dynCall_iiiiiii: dynCall_iiiiiii, dynCall_iiiii: dynCall_iiiii, dynCall_iiiiiiiii: dynCall_iiiiiiiii, dynCall_iii: dynCall_iii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real____muldsi3 = asm["___muldsi3"]; asm["___muldsi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____muldsi3.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};

var real__rlwejs_secret_alice = asm["_rlwejs_secret_alice"]; asm["_rlwejs_secret_alice"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_alice.apply(null, arguments);
};

var real__pthread_self = asm["_pthread_self"]; asm["_pthread_self"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__pthread_self.apply(null, arguments);
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

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real__rlwejs_secret_bytes = asm["_rlwejs_secret_bytes"]; asm["_rlwejs_secret_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_bytes.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__sbrk.apply(null, arguments);
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

var real____muldi3 = asm["___muldi3"]; asm["___muldi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____muldi3.apply(null, arguments);
};

var real__rlwejs_keypair_alice = asm["_rlwejs_keypair_alice"]; asm["_rlwejs_keypair_alice"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_keypair_alice.apply(null, arguments);
};

var real__rlwejs_secret_bob = asm["_rlwejs_secret_bob"]; asm["_rlwejs_secret_bob"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_bob.apply(null, arguments);
};
var ___muldsi3 = Module["___muldsi3"] = asm["___muldsi3"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _rlwejs_secret_alice = Module["_rlwejs_secret_alice"] = asm["_rlwejs_secret_alice"];
var _pthread_self = Module["_pthread_self"] = asm["_pthread_self"];
var _free = Module["_free"] = asm["_free"];
var _rlwejs_private_key_bytes = Module["_rlwejs_private_key_bytes"] = asm["_rlwejs_private_key_bytes"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _rlwejs_secret_bytes = Module["_rlwejs_secret_bytes"] = asm["_rlwejs_secret_bytes"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _rlwejs_public_key_bytes = Module["_rlwejs_public_key_bytes"] = asm["_rlwejs_public_key_bytes"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _rlwejs_init = Module["_rlwejs_init"] = asm["_rlwejs_init"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var _rlwejs_keypair_alice = Module["_rlwejs_keypair_alice"] = asm["_rlwejs_keypair_alice"];
var _memset = Module["_memset"] = asm["_memset"];
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

  writeStackCookie();

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
  checkStackCookie();
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
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
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


// EMSCRIPTEN_GENERATED_FUNCTIONS: ["_bitshift64Ashr","_i64Subtract","_sbrk","_i64Add","_memset","_pthread_self","___muldsi3","___muldi3","_memcpy"]


;

function dataReturn (returnValue, result) {
	if (returnValue === 0) {
		return result;
	}
	else {
		throw new Error('RLWE error: ' + returnValue);
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
	publicKeyBytes: Module._rlwejs_public_key_bytes(),
	privateKeyBytes: Module._rlwejs_private_key_bytes(),
	bytes: Module._rlwejs_secret_bytes(),

	/* Backwards compatibility */
	publicKeyLength: Module._rlwejs_public_key_bytes(),
	privateKeyLength: Module._rlwejs_private_key_bytes(),
	secretLength: Module._rlwejs_secret_bytes(),

	aliceKeyPair: function () {
		var publicKeyBuffer		= Module._malloc(rlwe.publicKeyBytes);
		var privateKeyBuffer	= Module._malloc(rlwe.privateKeyBytes);

		try {
			var returnValue	= Module._rlwejs_keypair_alice(
				publicKeyBuffer,
				privateKeyBuffer
			);

			return dataReturn(returnValue, {
				publicKey: dataResult(publicKeyBuffer, rlwe.publicKeyBytes),
				privateKey: dataResult(privateKeyBuffer, rlwe.privateKeyBytes)
			});
		}
		finally {
			dataFree(publicKeyBuffer);
			dataFree(privateKeyBuffer);
		}
	},

	aliceSecret: function (publicKey, privateKey) {
		var publicKeyBuffer		= Module._malloc(rlwe.publicKeyBytes);
		var privateKeyBuffer	= Module._malloc(rlwe.privateKeyBytes);
		var secretBuffer		= Module._malloc(rlwe.bytes);

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
				dataResult(secretBuffer, rlwe.bytes)
			);
		}
		finally {
			dataFree(publicKeyBuffer);
			dataFree(privateKeyBuffer);
			dataFree(secretBuffer);
		}
	},

	bobSecret: function (alicePublicKey) {
		var alicePublicKeyBuffer	= Module._malloc(rlwe.publicKeyBytes);
		var bobPublicKeyBuffer		= Module._malloc(rlwe.publicKeyBytes);
		var secretBuffer			= Module._malloc(rlwe.bytes);

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
				publicKey: dataResult(bobPublicKeyBuffer, rlwe.publicKeyBytes),
				secret: dataResult(secretBuffer, rlwe.bytes)
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


if (typeof module !== 'undefined' && module.exports) {
	rlwe.rlwe		= rlwe;
	module.exports	= rlwe;
}
else {
	self.rlwe		= rlwe;
}

//# sourceMappingURL=rlwe.debug.js.map