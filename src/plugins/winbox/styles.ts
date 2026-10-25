export const WINBOX_CSS = `[data-winbox-root]{z-index:10;pointer-events:none;isolation:isolate}
.winbox{position:absolute;left:0;top:0;display:flex;flex-direction:column;background:#0050ff;color:#000;border-radius:12px 12px 0 0;box-shadow:0 14px 28px rgba(0,0,0,.25),0 10px 10px rgba(0,0,0,.22);pointer-events:auto;font:14px/1.4 system-ui,-apple-system,sans-serif;transition:opacity .2s}
.winbox[hidden],.winbox.hide{display:none!important}
.winbox.max,.winbox[data-wm-stage=snapped]{border-radius:0}
.winbox:not(.focus){opacity:.92}
.wb-header{display:flex;flex-direction:row-reverse;align-items:center;flex:none;height:35px;color:#fff;cursor:move;user-select:none;-webkit-user-select:none;touch-action:none}
.wb-drag{display:flex;align-items:center;flex:1;min-width:0;padding-left:10px}
.wb-icon{display:none;flex:none;width:20px;height:20px;margin-right:6px;background:center/contain no-repeat}
.wb-title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.wb-control{display:flex;align-self:stretch;flex:none}
.wb-control>*{display:flex;align-items:center;justify-content:center;width:30px;cursor:pointer;opacity:.75;background:center/14px no-repeat}
.wb-control>*:hover{opacity:1}
.wb-min:before{content:"\\2013"}.wb-max:before{content:"\\25A1"}.wb-full:before{content:"\\26F6"}.wb-close:before{content:"\\00D7";font-size:20px}
.wb-body{position:relative;flex:1;min-height:0;margin:0 var(--wb-border,4px) var(--wb-border,4px);overflow:auto;background:#fff}
.wb-body>iframe{display:block;width:100%;height:100%;border:0}
.no-header .wb-header,.no-min .wb-min,.no-max .wb-max,.no-full .wb-full,.no-close .wb-close{display:none}
.no-shadow{box-shadow:none}.no-animation{transition:none}
.wb-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);pointer-events:auto}
.wb-backdrop[hidden]{display:none}
.wb-strip{position:absolute;left:0;bottom:0;display:flex;flex-wrap:wrap;gap:2px;pointer-events:auto}
.wb-strip>button{width:250px;max-width:40vw;height:35px;padding:0 10px;border:0;border-radius:12px 12px 0 0;background:#0050ff;color:#fff;font:inherit;text-align:left;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
[data-winbox-root] [data-wm-snap-preview]{background:rgba(0,80,255,.15);border:2px solid #0050ff;border-radius:8px}
`
