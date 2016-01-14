var Range = require('quilljs/lib/lib/range');

var LINE_FORMATS = {
  'align': true
};

//
//  1 Magenta
//  2 aqua
//  3 Yellow
//  4 Grey
//

// Add Authors here  hardcode now, dynamic later.
//
var AUTHORCOLORS = {
  "":"rgb(119,136,153)"
};


var BINARY_FORMATS = {
  'bold': true,
  'italic': true,
  'strike': true,
  'underline': true,
  'font': true,
  'size':true,
  'color': true,
  'background': true,
  'image': true,
  'link': true,
  'bullet': true,
  'list': true,
  'align':true,
  'author':true,
  'multi-cursor':true
};

var MIXED_FORMAT_VALUE = '*';

module.exports = DerbyQuill;
function DerbyQuill() {};



DerbyQuill.prototype.init = function() {
  this.quill = null;
  this.activeFormats = this.model.at('activeFormats');
  this.value = this.model.at('value');
  this.toolbar = this.model.at('toolbar');
};

DerbyQuill.prototype.view = __dirname;

DerbyQuill.prototype.create = function() {
  var self = this;

  var _author = self.page.params.url.substring(1);

  var Quill = require('quilljs');
  var options = {};
    options.theme = "snow";
    options.modules = {
      "link-tooltip": true,
      "toolbar": {"container":'#toolbar'},
      'image-tooltip': true,
      'multi-cursor': true
      };

  if(_author) {
    options.modules["authorship"] = {authorId: _author, enabled: true};
  }

  var quill = this.quill = new Quill(this.editor, options);

  if(_author) {
    var authorship = this.quill.getModule("authorship");
    authorship.addAuthor(_author, AUTHORCOLORS[_author]);
  }

  var cursorship = this.quill.getModule("multi-cursor");
  cursorship.setCursor(_author, this.quill.getLength()-1, _author, AUTHORCOLORS[_author]);

  // Hack - to get the HTML into the Quill Editor
  // and not just the view.
  this.quill.setHTML(this.model.data.value);
  var model = this.model;




  // THe Model has changed.  THis means ANOTHER quill connected to this
  // thing has changed the data.  Update the quill editor.
  //
  model.on("change", "value", function(newVal, oldVal, passed){
    self.quill.setHTML(newVal);
  });

  self.dom.on('click', function (mouseEvent) {
    if( "Toggle Author" == mouseEvent.target.title) {
      var a = self.quill.getModule("authorship");
          a.enable();
    }
  });

  var getDeltaEnd = function (delta) {
    for (var index in delta.ops){
      for (var name in delta.ops[index]) {
        switch(name){
          case "insert":
          case "delete":
              break;
          case "retain":
              return delta.ops[index][name];
              break;
        }

      }
    }
  }

  var getDeltaAuthor = function (delta) {
    for (var index in delta.ops){
      for (var name in delta.ops[index]) {
        switch(name){
          case "insert":
          case "delete":
          case "retain":
              break;
          case "attributes":
              return delta.ops[index].attributes.author;
        }

      }
    }

  }

  // this current user has changed or the model has changed.
  // need to check which one "user" or "api" made the change
  //
  quill.on('text-change', function(delta, source) {
    var _end = getDeltaEnd(delta);

    if(source == "user"){
      self.value.set(quill.editor.innerHTML);

    cursorship.moveCursor(_author, _end);
    _end++;
      self.quill.setSelection(_end, _end);
    }

    // else {
    //
    //   var _author = getDeltaAuthor(delta);
    //
    //   cursorship.moveCursor(_author, _end);
    // }

    var range = quill.getSelection();
    self.updateActiveFormats(range);
  });


  quill.on('selection-change', function(range, source) {
    self.updateActiveFormats(range);
  });

  // HACK: Quill should provide an event here, but we wrap the method to
  // get a hook into what's going on instead
  var prepareFormat = quill.prepareFormat;
  quill.prepareFormat = function(name, value) {
    prepareFormat.call(quill, name, value);
    self.activeFormats.set(name, value);
  };

  // Iframes will stop bubbling at their window, so re-dispatch all clicks
  // that bubble to the top of the iframe document on the containing element.
  // This is helpful for popups to figure out when they should close
  this.dom.on('click', quill.root.ownerDocument, function(e) {
    var event = new MouseEvent(e.type, e);
    self.editor.dispatchEvent(event);
  });

};

DerbyQuill.prototype.clearFormatting = function() {
  this.quill.focus();
  var range = this.quill.getSelection();
  var formats = this.getContainedFormats(range);
  for (type in formats) {
    this.setFormat(type, false);
  }
};

DerbyQuill.prototype.toggleFormat = function(type) {
  var value = !this.activeFormats.get(type);
  this.setFormat(type, value);
};

DerbyQuill.prototype.setFormat = function(type, value) {
  this.quill.focus();
  var range = this.quill.getSelection();
  if (range.isCollapsed()) {
    this.quill.prepareFormat(type, value);
  } else if (LINE_FORMATS[type]) {
    this.quill.formatLine(range, type, value, 'user');
  } else {
    this.quill.formatText(range, type, value, 'user');
  }
};

DerbyQuill.prototype.updateActiveFormats = function(range) {
  if (!range) return;
  var activeFormats = this.getActiveFormats(range);
  this.activeFormats.set(activeFormats);
};

// Formats that are contained within part of the range
DerbyQuill.prototype.getContainedFormats = function(range) {
  return this._getFormats(range, addContainedFormats);
};

// Formats that span the entire range
DerbyQuill.prototype.getActiveFormats = function(range) {
  return this._getFormats(range, addActiveFormats);
};

DerbyQuill.prototype._getFormats = function(range, addFn) {
  var formats = {};
  var ops = this.getRangeContents(range).ops;
  var lines = this.getRangeLines(range);
  addFn(formats, ops, 'attributes');
  addFn(formats, lines, 'formats');
  return formats;
};

function addContainedFormats(formats, items, key) {
  for (var i = 0; i < items.length; i++) {
    var itemFormats = items[i][key];
    for (var type in itemFormats) {
      formats[type] = true;
    }
  }
}

function addActiveFormats(formats, items, key) {
  var counts = {};
  for (var i = 0; i < items.length; i++) {
    var itemFormats = items[i][key];
    for (var type in itemFormats) {
      if (counts[type]) {
        counts[type]++;
        if (formats[type] !== itemFormats[type]) {
          formats[type] = MIXED_FORMAT_VALUE;
        }
      } else {
        counts[type] = 1;
        formats[type] = itemFormats[type];
      }
    }
  }
  for (var type in counts) {
    if (counts[type] !== items.length) {
      if (BINARY_FORMATS[type]) {
        delete formats[type];
      } else {
        formats[type] = MIXED_FORMAT_VALUE;
      }
    }
  }
}

DerbyQuill.prototype.getRangeContents = function(range) {
  if (range.isCollapsed()) {
    var start = Math.max(0, range.start - 1);
    return this.quill.getContents(start, range.end);
  }
  return this.quill.getContents(range);
};

DerbyQuill.prototype.getRangeLines = function(range) {
  var line = this.quill.editor.doc.findLineAt(range.start)[0];
  var lastLine = this.quill.editor.doc.findLineAt(range.end)[0];
  var lines = [];
  while (line) {
    lines.push(line);
    if (line === lastLine) break;
    line = line.next;
  }
  return lines;
};

DerbyQuill.prototype.setRangeContents = function(range, value, attributes) {
  var startLength = this.quill.getLength();
  this.quill.setContents({
    startLength: startLength
    , ops: [
    {start: 0, end: range.start}
    , {value: value, attributes: attributes}
    , {start: range.end, end: startLength}
    ]
  });
  var end = range.start + value.length;
  if (range.isCollapsed()) {
    this.quill.setSelection(end, end);
  } else {
    this.quill.setSelection(range.start, end);
  }
};

DerbyQuill.prototype.createRange = function(start, end) {
  return new Range(start, end);
};
