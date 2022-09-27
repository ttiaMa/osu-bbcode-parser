window.renderBBCode = (function () {

var states = [
  /\[/,     // 0 outside tag
  /[=[\]]/, // 1 inside tag
  /\]/      // 2 parsing attribute
  // state 3 is finding closing tag
];

var tagList = ['*', 'img', 'url', 'color', 'size', 'font', 'quote', 'spoiler', 'hr', 'b', 'i', 'u', 's', 'centre', 'notice', 'box'];
var whitelist = {
  'img': /^https?:\/\//, 'url': /^(https?|ftps?|ircs?):\/\//, 'color': /[A-Za-z]+|#(?:[0-9a-f]{3}){1,2}/, 'font': '[1-7]'
};
var tagInfo = [
  ['li'],
  ['img', 'src', {style: 'max-width:500px;', alt: '', border: 0}],
  ['a', 'href', {rel: 'noreferrer', target: '_blank'}],
  ['font', 'color'],
  ['div', 'size'],
  ['font', 'face'],
  function (arg, content) {
    var el = document.createDocumentFragment();
    
    var tmp = document.createElement('p');
    tmp.className = 'sub';
    tmp.innerHTML = '<b></b>';
    tmp.firstChild.textContent = arg ? arg + ' escreveu:' : 'Citação:';
    el.appendChild(tmp);
    
    tmp = document.createElement('table');
    tmp.className = 'main';
    tmp.setAttribute('border', 1);
    tmp.setAttribute('cellspacing', 0);
    tmp.setAttribute('cellpadding', 10);
    tmp.innerHTML = '<tr><td style="border: 1px black dotted"></td></tr>';
    tmp.firstChild.firstChild.appendChild(parse(content));
    
    el.appendChild(tmp);
    
    return el;
  },
  function (arg, content) {
    var el = document.createElement('div');
    el.textContent = (arg || 'Spoiler') + ' ';
    var toggleImg = document.createElement('img');
    
    toggleImg.src = 'images/plus.gif';
    toggleImg.title = 'Spoiler';
    toggleImg.alt = '';
    el.appendChild(toggleImg);
    
    var spoilerDiv = document.createElement('div');
    spoilerDiv.appendChild(parse(content));
    spoilerDiv.style.display = 'none';
    el.appendChild(spoilerDiv);
    
    return el;
  }
];

function parse(text) {
  var oldp = 0;
  var newp = 0;
  var state = 0;
  var result = document.createDocumentFragment();
  var tagArr = [];
  var attributeArr = [];
  
  function addTextNode(text) {
    text.split('\n').forEach(function (content, n, arr) {
      result.appendChild(
        document.createTextNode(content)
      );
      
      if (n !== arr.length - 1) {
        result.appendChild(document.createElement('br'));
      }
    });
  }
  
  do {
    newp = text
      .substr(oldp)
      .search(states[state]);
    
    var foundTag = newp !== -1;
    if (foundTag) {
      newp += oldp;
    } else {
      newp = text.length;
    }
    
    var content;
    var tag;
    var closingTag;
    var closingAttr;
    var hasAttributes;
    var tagIndex = -1;
    var foundChar;
    
    switch (state) {
      case 0:
        content = text.substring(oldp, newp);
        
        if (content) {
          addTextNode(content);
        }
        if (foundTag) {
          state = 1;
        }
        break;
        
      case 1:
        tag = text.substring(oldp, newp);
        tagArr.push(tag);
        
        foundChar = text.charAt(newp);
        
        if (foundChar === '[') {
          addTextNode('[');
          break;
        }
        
        hasAttributes = foundChar === '=';
        
        if (!hasAttributes) {
          attributeArr.push('');
          
          if (tag === '*' || tag === 'hr') {
            text = text.substr(0, newp + 1) + '[/' + tag + ']' +
              text.substr(newp + 1);
          }
        }
        state = 3 - hasAttributes;
        break;
        
      case 2:
        attributeArr.push(
          text.substring(oldp, newp));
        
        state = 3;
        break;
    }
    
    oldp = newp + 1;
    
    if (state === 3) {
      closingTag = tagArr.pop();
      closingAttr = attributeArr.pop();
      
      var endedStartTag = text.indexOf(']', newp);
      newp = closingTag === 'img' && closingAttr ? endedStartTag : text.indexOf('[/' + closingTag + ']', oldp);
      
      var openedTag;
      if (newp === -1) {
        newp = text.length;
        openedTag = true;
      } else {
        tagIndex = tagList.indexOf(closingTag);
      }
      
      content = text.substring(oldp, newp);
      
      if (tagIndex === -1) {
        addTextNode('[' + closingTag + (closingAttr ? ('=' + closingAttr) : '') + (endedStartTag === -1 ? '' : ']'));
        if (content) {
          result.appendChild(parse(content));
        }
        if (!openedTag) {
          addTextNode('[/' + closingTag + ']');
        }
      } else if (typeof tagInfo[tagIndex] === 'function'){
        result.appendChild(tagInfo[tagIndex](closingAttr, content));
      } else {
        var info = tagInfo[tagIndex] || [];
        var el = document.createElement(
          info[0] || closingTag
        );
        
        var attributes = info[2];
        if (attributes) {
          for (var i in attributes) {
            if (attributes.hasOwnProperty(i)) {
              el.setAttribute(i, attributes[i]);
            }
          }
        }
        
        var whitelistConfig = whitelist[closingTag];
        var attribute;
        
        if (closingTag === 'img') {
          attribute = closingAttr || content;
          
          if (!whitelistConfig || whitelistConfig.test(attribute)) {
            el.setAttribute(info[1], attribute);
          } else {
            el = document.createTextNode('');
          }
        } else if (closingTag === 'url') {
          attribute = closingAttr || content;
          
          if (!whitelistConfig || whitelistConfig.test(attribute)) {
            el.setAttribute(info[1], attribute);
            el.appendChild(parse(content));
          } else {
            el = document.createTextNode('');
          }
        } else if (info[1]) {
          el.setAttribute(info[1], closingAttr);
          el.appendChild(parse(content));
        } else {
          el.appendChild(parse(content));
        }
        result.appendChild(el);
      }
      
      oldp = endedStartTag === -1 || openedTag ? text.length : text.indexOf(']', newp) + 1;
      state = 0;
    }
  } while (oldp < text.length);
  
  switch (state) {
    case 1:
      addTextNode('[');
      break;
    case 2:
      addTextNode('[' + tagArr.pop());
      break;
    case 3:
      addTextNode('[' + tagArr.pop() + '=' + attributeArr.pop());
      break;
  }
  
  return result;
}

return parse;

}());

if (typeof input !== 'undefined') {
  function render () {
    var result = renderBBCode(input.value.trim());
    formattedoutput.innerHTML = '';
    formattedoutput.appendChild(result);
    rawoutput.textContent = formattedoutput.innerHTML;
  }
  render();
  input.oninput = render;
}