_defCommand('unzip', [ARGT.file.concat(['*.zip'])], function (args, ctx, vt) {
  if (args.length === 1) {
    tr = ctx.traversee(args[0])
    if (tr.item && tr.room.ismod('w', ctx)) {
      tr.item.fire_event(vt, 'unzip', args, 0)
      return _stdout('')
    } else {
      return _stderr(_('item_cmd_unknow', 'unzip'))
    }
  }
  return _stderr(_('incorrect_syntax'))
})