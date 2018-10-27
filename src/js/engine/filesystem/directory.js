var globalSpec = {}

function Room (roomname, text, picname, prop) {
  prop = prop || {}
  if (!prop.mod) { prop.mod = 755 }
  File.call(this, d(roomname, _(PO_DEFAULT_ROOM, [])), picname, prop)
  this.previous = this
  this.children = []
  this.items = []
  this.commands_lock = {}
  this.text = d(text, _(PO_DEFAULT_ROOM_DESC))
  this.starter_msg = null
  this.enter_callback = null
  this.leave_callback = null
  this._last_to = this
}
function enterRoom (new_room, vt) {
  var ctx = vt.getContext()
  console.log('enterRoom', new_room, ctx)
  var prev = ctx.room
  if (prev && !prev.isParentOf(new_room)) {
    prev.doLeaveCallbackTo(new_room)
  }
  ctx.room = new_room
  state.setCurrentContext(ctx)
  if (typeof new_room.enter_callback === 'function') {
    new_room.enter_callback(new_room, vt)
  }
  // TODO : put this in a clean way // depends on background.js
  enter_room_effect()
  //
  return [new_room.toString(), new_room.text]
}
Room.parse = function (str) {
  return window[str]
}
Room.prototype = union(File.prototype, {
  stringify: function () { return this.varname },
  fire_event: function (vt, cmd, args, idx, ct) {
    ct = d(ct, {})
    var ev_trigger = null
    console.log('EVENT ' + cmd)
    var context = { term: vt, room: this, arg: (def(idx) ? args[idx] : null), args: args, i: idx, ct: ct }
    if (ct.hasOwnProperty('unreachable_room')) {
      if ((ct.unreachable_room.name in globalSpec) && (cmd in globalSpec[ct.unreachable_room.name])) {
        ev_trigger = globalSpec[ct.unreachable_room.name][cmd]
      }
    } else if (cmd in this.cmd_event) {
      ev_trigger = this.cmd_event[cmd]
    }
    if (ev_trigger) {
      var ck = (typeof ev_trigger === 'function' ? ev_trigger(context) : ev_trigger)
      if (ck) {
        console.log(this.uid + ' FIRE ' + ck)
        this.fire(ck)
      }
    }
  },
  addCommand: function (cmd, options) {
    if (def(options)) {
      this.setCommandOptions(cmd, options)
    }
    return this
  },
  // callback when entering in the room
  setEnterCallback: function (fu) {
    this.enter_callback = fu
    return this
  },
  setLeaveCallback: function (fu) {
    this.leave_callback = fu
    return this
  },
  // a message displayed on game start
  getStarterMsg: function (prefix) {
    prefix = prefix || ''
    if (this.starter_msg) {
      return prefix + this.starter_msg
    } else {
      return prefix + _(POPREFIX_CMD + 'pwd', [this.name]).concat('\n').concat(this.text)
    }
  },
  setStarterMsg: function (txt) {
    this.starter_msg = txt
    return this
  },
  // Room picture
  // item & people management
  addItem: function (newitem) {
    this.items.push(newitem)
    newitem.room = this
    return this
  },
  addDoor: function (newchild, wayback) {
    if (def(newchild) && !this.hasChild(newchild)) {
      this.children.push(newchild)
      if (d(wayback, true)) {
        newchild.room = this
      }
    }
    return this
  },
  removeItemByIdx: function (idx) {
    return ((idx == -1) ? null : this.items.splice(idx, 1)[0])
  },
  removeItemByName: function (name) {
    idx = this.idxItemFromName(name)
    return this.removeItemByIdx(idx)
  },
  hasItem: function (name, args) {
    args = args || []
    idx = this.idxItemFromName(_(POPREFIX_ITEM + name, args))
    return (idx > -1)
  },
  removeItem: function (name, args) {
    args = args || []
    idx = this.idxItemFromName(_(POPREFIX_ITEM + name, args))
    return this.removeItemByIdx(idx)
  },
  hasPeople: function (name, args) {
    args = args || []
    idx = this.idxItemFromName(_(POPREFIX_PEOPLE + name, args))
    return (idx > -1)
  },
  removePeople: function (name, args) {
    args = args || []
    idx = this.idxItemFromName(_(POPREFIX_PEOPLE + name, args))
    return this.removeItemByIdx(idx)
  },
  idxItemFromName: function (name) {
    return this.items.map(objToStr).indexOf(name)
  },
  idxChildFromName: function (name) {
    return this.children.map(objToStr).indexOf(name)
  },
  getItemFromName: function (name) {
    //    console.log(name);
    idx = this.idxItemFromName(name)
    return ((idx == -1) ? null : this.items[idx])
  },
  getItem: function (name) {
    return this.getItemFromName(_('item_' + name))
  },
  getDir: function (arg, ctx) {
    let r = null
    if (arg === '~') {
      r = $home
    } else if (arg === '..') {
      r = this.room
    } else if (arg === '.') {
      r = this
    } else if (arg && arg.indexOf('/') == -1) {
      r = this.children.filter((i) => arg == i.toString()).shift()
    }
    return (r) || null
  },

  // linked room management
  getChildFromName: function (name) {
    idx = this.children.map(objToStr).indexOf(name)
    return ((idx == -1) ? null : this.children[idx])
  },
  hasChild: function (child) {
    idx = this.children.map(objToStr).indexOf(child.name)
    return ((idx == -1) ? null : this.children[idx])
  },
  doLeaveCallbackTo: function (to) {
    t = this
    console.log(t.toString(), 'doLeaveCallbackTo', to.toString())
    if (t.uid != to.uid && t.room) {
      if (typeof t.leave_callback === 'function') {
        t.leave_callback()
      }
      t.room.doLeaveCallbackTo(to)
    }
  },
  doEnterCallbackTo: function (to) {
    t = this
    if (t.uid === to.uid) {
    } else if (t.children.length) {
      if (typeof t.leave_callback === 'function') {
        t.enter_callback()
      }
      if (t.room) {
        t.room.doEnterCallbackTo(to)
      }
    }
  },
  isParentOf: function (par) {
    return par.room && (par.room.uid == this.uid || this.isParentOf(par.room))
  },
  removePath: function (child) {
    if (rmIdxOf(this.children, child)) {
      child.room = null
    }
  },
  destroy: function () {
    rmIdxOf(this.room.children, this)
    this.room = null
  },
  setOutsideEvt: function (name, fun) {
    globalSpec[this.name][name] = fun
    return this
  },
  unsetOutsideEvt: function (name) {
    delete globalSpec[this.name][name]
    return this
  },

  // command management
  setCommandOptions: function (cmd, options) {
    this.commands_lock[cmd] = options
    return this
  },
  removeCommandOptions: function (cmd) {
    delete this.commands_lock[cmd]
    return this
  },

  /* Returns the room and the item corresponding to the path
   * if item is null, then the path describe a room and  room is the full path
   * else room is the room containing the item */
  traversee: function (path) {
    let [room, lastcomponent] = this.pathToRoom(path)
    let ret = { room: room, item_name: lastcomponent, item_idx: -1 }
    if (room) {
      ret.room_name = room.name
      if (lastcomponent) {
        ret.item = ret.room.items.find((it, i) =>
          lastcomponent === it.toString() && (ret.item_idx = i) + 1)
      }
    }
    return ret
  },
  checkAccess: function (ctx) {
    return this.ismod('x', ctx) && (ctx.room.uid == this.room.uid ? true : this.room.checkAccess(ctx))
  },
  pathToRoom: function (path) {
    // returns [ room associated to the path,
    //           non room part of path,
    //           valid path ]
    var room = this
    let pat = path.split('/')
    let end = pat.slice(0, -1).findIndex((r) => !(room = room.getDir(r)))
    console.log(end)
    let pathstr = pat.slice(0, end).join('/')
    let lastcomponent = null
    let cancd
    if (room) {
      lastcomponent = pat.pop() || null
      if (cancd = room.getDir(lastcomponent)) {
        room = cancd
        pathstr += (end <= 0 ? '' : '/') + lastcomponent + '/'
        lastcomponent = null
      }
    }
    return [room, lastcomponent, pathstr]
  },
  newItemBatch: function (id, names, picname, prop) {
    var ret = []
    prop = d(prop, {})
    for (var i = 0; i < names.length; i++) {
      prop.poid = id
      prop.povars = [names[i]]
      ret[i] = new Item('', '', picname, prop)
      this.addItem(ret[i])
    }
    return ret
  },
  newItem: function (id, picname, prop) {
    prop = d(prop, {})
    prop.poid = d(prop.poid, id)
    var ret = new Item('', '', picname, prop)
    this.addItem(ret)
    return ret
  },
  newPeople: function (id, picname, prop) {
    prop = d(prop, {})
    prop.poid = d(prop.poid, id)
    var ret = new People('', '', picname, prop)
    this.addItem(ret)
    return ret
  },
  newRoom: function (id, picname, prop) {
    var ret = newRoom(id, picname, prop)
    this.addDoor(ret)
    return ret
  },
  concatNew: function (id, picname, prop) {
    var ret = newRoom(id, picname, prop)
    this._last_to.addDoor(ret)
    this._last_to = ret
    return this
  }
})

function newRoom (id, picname, prop) {
  // this function automatically set the variable $id to ease game saving
  var poid = POPREFIX_ROOM + id
  var n = new Room(
    _(poid, [], { or: PO_DEFAULT_ROOM }),
    _(poid + POSUFFIX_DESC, [], { or: PO_DEFAULT_ROOM_DESC }),
    picname,
    prop)
  n.varname = '$' + id// currently undefined for user created rooms, see mkdir
  n.poid = poid
  n.picture.setImgClass(n.varname.replace('$', 'room-'))
  window[n.varname] = n
  return n
}
