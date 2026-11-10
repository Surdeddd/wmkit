# [0.13.0](https://github.com/Surdeddd/wmkit/compare/v0.12.1...v0.13.0) (2026-11-10)


### Bug Fixes

* **angular:** a window component rendered again binds its element instead of throwing ([707bbc4](https://github.com/Surdeddd/wmkit/commit/707bbc4df8d725b0cb2e3ddd46fdfbddc2c17bd6))
* **chrome:** skin templates refuse placeholders after a script whose content could keep it open past its first end tag ([560ac0e](https://github.com/Surdeddd/wmkit/commit/560ac0e5eebebc4e5848c93ac6a9a1ea23b6ad18))
* **chrome:** skin templates refuse placeholders after SVG or MathML markup that a browser could parse differently ([eea8c54](https://github.com/Surdeddd/wmkit/commit/eea8c5462e28a4ec3255700d98e75d2f3ba75bb6))
* **chrome:** skin templates refuse spaces that HTML does not treat as whitespace inside a tag ([ae08f67](https://github.com/Surdeddd/wmkit/commit/ae08f679c4d3c56d03c26cc302c5b36b60fee47f))
* **core:** a bad number never enters the state, and one corrupt window no longer costs the whole saved layout ([35042b3](https://github.com/Surdeddd/wmkit/commit/35042b342bd704861f0a9135ece8a36bc475300a))
* **core:** a cancelled gesture leaves the history exactly as it was, so a returning focus run still gives redo back ([f398fa9](https://github.com/Surdeddd/wmkit/commit/f398fa9c6b75d6bb1be27f3804fb381f9e50e20b))
* **core:** a minimized modal brought back by snapTo takes the focus ([7157bd0](https://github.com/Surdeddd/wmkit/commit/7157bd0a8ed218e0227e9e32fb62d6c7ee860faa))
* **core:** a tab group frame honours the limits of every member and stays the same after undo, reload or resize ([7d8d251](https://github.com/Surdeddd/wmkit/commit/7d8d25184eacec1cfa67c60ae1fb7bab7818674b))
* **core:** an update with equal values still announces itself but costs no undo step ([1ca4cce](https://github.com/Surdeddd/wmkit/commit/1ca4cceed8ada9963ededad087f8e631225012fd))
* **core:** arrange and minimizeAll leave docked and unminimizable windows alone, and bulk commands run in linear time ([0b27f34](https://github.com/Surdeddd/wmkit/commit/0b27f34ca152c53fffa5e8d02b3406352432a5a5))
* **core:** bad numbers in the manager options fall back to the built-in defaults ([d135353](https://github.com/Surdeddd/wmkit/commit/d13535393c3daa31c3540e20050bdce4e8b05071))
* **core:** every undo step changes something: focus clicks that end where they began leave no step ([f644c4a](https://github.com/Surdeddd/wmkit/commit/f644c4ae6070100b6b96289f1e4f3363903a3da8))
* **core:** named layouts keep cyclic meta, dates and infinite limits, and fall back to a JSON copy only for values that cannot be cloned ([80528d4](https://github.com/Surdeddd/wmkit/commit/80528d4ce0b8d2f60eb6e8ebd2eef948ee106351))
* **core:** snapTo accepts an empty rectangle inside the viewport again and refuses one that starts outside it ([bd8e0f5](https://github.com/Surdeddd/wmkit/commit/bd8e0f58682ff0ccb09bdb6d55e92bca29372882))
* **core:** snapTo clamps a rectangle that starts outside the viewport but overlaps it, and refuses only one with no overlap ([f71b625](https://github.com/Surdeddd/wmkit/commit/f71b6258d3741dfbd2b26522549aa0bed7409fc2))
* **core:** the same listener subscribed twice counts as two subscriptions ([5ca2359](https://github.com/Surdeddd/wmkit/commit/5ca2359cc20f57268f95fbada635ae8cfec9bb93))
* **core:** undo, redo and calls that change nothing keep untouched windows and report only real changes ([ec96ab5](https://github.com/Surdeddd/wmkit/commit/ec96ab5679d3d85e865cbd5f6bd1e912b8f760fd))
* **core:** update counts a meta, minSize or maxSize object as a change again, so an in-place change can be announced ([0caace8](https://github.com/Surdeddd/wmkit/commit/0caace86f39d465f01b38a2af9cb10d3eb4f987a))
* **dock:** a createDock that fails leaves no dock behind, so the next createDock on the same manager works ([b3295e6](https://github.com/Surdeddd/wmkit/commit/b3295e61b838ca83fbca6ce4019cbcb82ab81213))
* **dock:** a docked window fills its panel whatever its maximum size or aspect ratio, and gets both back when undocked ([f4d1fd6](https://github.com/Surdeddd/wmkit/commit/f4d1fd6fb8d0c906b1114b960fd3369af7e666c2))
* **dock:** a docked window moved to another workspace floats there without taking or moving the focus here ([52ab643](https://github.com/Surdeddd/wmkit/commit/52ab643a95b3b3fb4770703beb63ced60cbea982))
* **dock:** a layout set before the desktop has a size waits for one instead of being dropped, so panels no longer stay in a cascade ([7b3643c](https://github.com/Surdeddd/wmkit/commit/7b3643c3e166d7f5c0aede0cb8f7da99912194f6))
* **dock:** a saved layout survives an unmount and is in place from the first frame, and a broken one is dropped instead of throwing ([c2b41c3](https://github.com/Surdeddd/wmkit/commit/c2b41c3152a185a864d1c1d033ad7df65cbbf661))
* **dock:** a second dock on the same window manager is refused until the first is destroyed ([ef93841](https://github.com/Surdeddd/wmkit/commit/ef9384117eb838ab1160f8803fa7e96073b2d889))
* **dock:** a separator drag ends when its pointer is released even if the separator left the page, and its Escape stays with the dock ([b2c0b79](https://github.com/Surdeddd/wmkit/commit/b2c0b79aecb3e6594b5e32ef1cf62566071c61a0))
* **dock:** a stored layout dropped as broken gives its windows their flags back instead of leaving them locked ([d7fcb4d](https://github.com/Surdeddd/wmkit/commit/d7fcb4d9502456a99b586d0196671fc641ca3ed5))
* **dock:** every panel lands in its own place when a tab is moved out or the layout is reset, and a picked tab stays picked ([3fa7014](https://github.com/Surdeddd/wmkit/commit/3fa701482826edd68eb0031a874fc759bdb71317))
* **dock:** the layout follows tabs ungrouped, windows grouped and panels moved to another workspace around the dock ([073f156](https://github.com/Surdeddd/wmkit/commit/073f1561472251d2051a059a2cf4b9f5e7f17012))
* **docs:** every docs page links its translation and describes itself to search engines ([9ff7e22](https://github.com/Surdeddd/wmkit/commit/9ff7e223b14b8dbbeac9caf55de7a9be52f130b3))
* **docs:** extension-less addresses leave the Russian docs root and files with an extension alone ([4794393](https://github.com/Surdeddd/wmkit/commit/4794393f8289887b6d835127e2f1f3ddb9053ea1))
* **docs:** inline code keeps its double braces on the docs site instead of rendering empty ([5f63efa](https://github.com/Surdeddd/wmkit/commit/5f63efabb22e3e40d4c8e170768cde2f1816721a))
* **dom:** a desktop inside an iframe or a popup window answers its buttons and keys ([00aba53](https://github.com/Surdeddd/wmkit/commit/00aba53a69e258de4b67893618430ee2d0823dfa))
* **dom:** a docked, snapped or maximized window dragged and released within one frame still docks or snaps where it is dropped ([9a47a4c](https://github.com/Surdeddd/wmkit/commit/9a47a4c544c508050dea5c5356e1f29c3739a3d7))
* **dom:** a drag never groups a modal window into tabs, as the dragged window or the target ([1639f26](https://github.com/Surdeddd/wmkit/commit/1639f26ba8b91092ac76f8ed49f8e2acffdfeede))
* **dom:** a drag or resize ends when its handle is removed from the page mid gesture ([7cb9ef7](https://github.com/Surdeddd/wmkit/commit/7cb9ef7e2ee30f213501595b9b581f4b5f59d778))
* **dom:** a first title that reads like the ligature of an icon beside it still shows up ([611d82f](https://github.com/Surdeddd/wmkit/commit/611d82fe10161750cf3bdfd3900373853a4d1b27))
* **dom:** a focused iframe no longer pulls focus back to its window, and stops being watched when the pointer leaves ([0907667](https://github.com/Surdeddd/wmkit/commit/09076679b3cd2b13bd80a3d5e5fee2c1cec4d5a8))
* **dom:** a gesture plugin that claims the desktop cancels a running pointer drag instead of orphaning it ([7de452a](https://github.com/Surdeddd/wmkit/commit/7de452a0b618a74cf98fc1ec53d867aec2999cad))
* **dom:** a window closed during its drag, resize or drop stays undoable, and a drop commits once ([5e53212](https://github.com/Surdeddd/wmkit/commit/5e53212856f7fdbb23b4f505067ff9e6106cfb36))
* **dom:** a window detached while minimized or on another workspace is shown again ([04130ad](https://github.com/Surdeddd/wmkit/commit/04130ad05ddabfb91366a8606f9e873213a5a7f1))
* **dom:** an element bound to the same window takes over when the attached one unbinds ([b875986](https://github.com/Surdeddd/wmkit/commit/b8759864018cb568f53f3ca5b14f17c268aecbc9))
* **dom:** an unknown skin in a transaction no longer drops the other skin changes, stacking and focus of that pass ([d38b79a](https://github.com/Surdeddd/wmkit/commit/d38b79af6917637b02d9755e3b4c618f73107073))
* **dom:** attach a desktop with the automatic viewport where ResizeObserver is missing ([dbdb089](https://github.com/Surdeddd/wmkit/commit/dbdb089385b47be51999e971494051b846aa2735))
* **dom:** attachWindow refuses a destroyed desktop and an element that already drives another window ([9b4f17c](https://github.com/Surdeddd/wmkit/commit/9b4f17c231fef449033206ede5db734aa020b1e1))
* **dom:** beforeClose also guards the close action that a desktop or a skin hands out ([3749a0c](https://github.com/Surdeddd/wmkit/commit/3749a0cf5a27741ce17bccaeb1de76bbce421dfd))
* **dom:** Ctrl or Cmd + Alt + PageUp and PageDown reach the page when the focused window has no tabs to switch ([ff813ae](https://github.com/Surdeddd/wmkit/commit/ff813ae38eb7021e5e8246bc9d3c6a02e110b71a))
* **dom:** Escape puts a dragged window back exactly as it was, snap rectangle included ([c3a042f](https://github.com/Surdeddd/wmkit/commit/c3a042ff5b47c93dded4ac7b55b9f5b2e4fa7f7a))
* **dom:** Escape that cancels a drag or resize no longer reaches the page's own key handlers ([caef37d](https://github.com/Surdeddd/wmkit/commit/caef37d01827efde7acbd680a289a8fe7f900e25))
* **dom:** F6 no longer switches windows in the middle of a drag ([72c4f19](https://github.com/Surdeddd/wmkit/commit/72c4f19a3586787fd7fdd421a83238d449b2d3c4))
* **dom:** holding an arrow key moves or resizes a window in a single undo step ([9741b28](https://github.com/Surdeddd/wmkit/commit/9741b28c67b769042b3c035fd8d8122f58baad00))
* **dom:** keyboard focus follows the window the manager focused last after a restore ([6aa8726](https://github.com/Surdeddd/wmkit/commit/6aa87260ed492cd6db985b55ff9df08f0edfabc3))
* **dom:** minimizing many windows measures them all before drawing, and a failed flight leaves no ghost behind ([e3ed07e](https://github.com/Surdeddd/wmkit/commit/e3ed07e2fccb95dad0851e22c2ef83581fc9d761))
* **dom:** no timer, frame or focus pull of a destroyed desktop runs later ([f529f67](https://github.com/Surdeddd/wmkit/commit/f529f679fd35e81d8e262685ef828fd8464cba2e))
* **dom:** pointer positions account for the desktop's border, scroll and scale transform ([3009f8b](https://github.com/Surdeddd/wmkit/commit/3009f8b147bb647814d69eb0a7a51493343cbf61))
* **dom:** resizing a tab group from the left or top edge keeps the opposite edge still at a tab's size limit ([21ea59e](https://github.com/Surdeddd/wmkit/commit/21ea59e387686432120f27af497a6f59ca2a4cec))
* **dom:** resizing a tab group from the left or top keeps the opposite edge still under the group's smallest aspect ratio ([def1000](https://github.com/Surdeddd/wmkit/commit/def1000086e4c5a44ef994bdf6911a879c76ab82))
* **dom:** Tab inside a modal also stops at controls with fixed position ([8a6f580](https://github.com/Surdeddd/wmkit/commit/8a6f580bd8d65cd23492c27ea8abdceec0ce4398))
* **dom:** the [data-wm-title] node keeps icons and text around the title when it is renamed ([debdc53](https://github.com/Surdeddd/wmkit/commit/debdc532c9c9243f2efbdcecbcfe083a3372dd20))
* **dom:** the announcer stays quiet for a silenced message and sums up many windows changed at once ([b9d03c6](https://github.com/Surdeddd/wmkit/commit/b9d03c65233e2052851195e80fd622069a1b5706))
* **dom:** the iframe shield under a modal covers late windows and frames, and gives pointer events back as they were ([c3d5fa7](https://github.com/Surdeddd/wmkit/commit/c3d5fa797eb61c01ac031d291e85d6535d8aaef1))
* **dom:** the stacking pass no longer holds on to detached windows until the next order change ([3ce9170](https://github.com/Surdeddd/wmkit/commit/3ce9170163c80f9b9c4385043333ae7a6ec61c9c))
* **dom:** the title node keeps ligature icons when it renames the title or cannot find it ([f5bddc7](https://github.com/Surdeddd/wmkit/commit/f5bddc749610e041ed87c4ea8bb536672b1b366d))
* **dom:** undo and window shortcuts stay out of form fields and editable text whatever the drag-handle selector ([1c327f0](https://github.com/Surdeddd/wmkit/commit/1c327f0d5b2472e9044f922bd9ce6905fe9b0f36))
* **dom:** window buttons act only on their own window in nested desktops, and a middle click is refused under a modal ([42c2aa6](https://github.com/Surdeddd/wmkit/commit/42c2aa6a626b5dd1896a932e8e9dbb3ce6308f5d))
* **elements:** a closed panel stays closed when a re-render replaces its element, and opens only once the page has dropped it ([c09368f](https://github.com/Surdeddd/wmkit/commit/c09368fcaef364ba3c7de5912ac0c459c5b8e241))
* **elements:** a closed window comes back with undo and stays closed after a reload, and the stage attribute follows undo and redo ([819ed1a](https://github.com/Surdeddd/wmkit/commit/819ed1a1d6b6f209188e2482c286fcaa2639799c))
* **elements:** a new wm-window for a window the user closed opens it again, while a reload still keeps the panel closed ([25a39b3](https://github.com/Surdeddd/wmkit/commit/25a39b374349a7f7cdd38fe8a807ee6b8c088d4e))
* **elements:** changing one position or size-limit attribute keeps the other side where it is ([f70db6a](https://github.com/Surdeddd/wmkit/commit/f70db6a53efa500705b432e63a17f127b1aa31a6))
* **elements:** changing only the width or the height of a window keeps the other dimension ([1c8f93d](https://github.com/Surdeddd/wmkit/commit/1c8f93de44dac2004bc29eb8e54ddab12c788c26))
* **elements:** importing the web components on a server no longer throws ([e74026e](https://github.com/Surdeddd/wmkit/commit/e74026eba9d6f1b4eef2c34fbd5132c2470d7667))
* **elements:** options, messages, styles and windowId set before the elements are defined survive the upgrade ([3e45ad8](https://github.com/Surdeddd/wmkit/commit/3e45ad868ce9fde6ef9a2e85f66b05ab635d061f))
* **elements:** the window chrome shows only the buttons the window allows, so a docked panel has no dead minimize button ([c6122ca](https://github.com/Surdeddd/wmkit/commit/c6122ca119fae34887261499744cacc4c9fc5366))
* **elements:** undo and hydrate can no longer bring back or drop a closed-panel mark the page has settled ([20e1c05](https://github.com/Surdeddd/wmkit/commit/20e1c0512e185fd20bad77a98dc34bb46cc072e7))
* **gestures:** a finger lifted over a widget that stops the event no longer turns the next touch into a pinch or swipe ([4e113ed](https://github.com/Surdeddd/wmkit/commit/4e113eda4a05621869bf932b8d7e1dd95a95d73f))
* **persist:** a steady stream of changes is saved at least every two seconds, adjustable with maxWait ([bdc4edd](https://github.com/Surdeddd/wmkit/commit/bdc4edddaafb23432e11a5d71ba807a134b06cb8))
* **persist:** without onError only the first failure of each kind reaches reportError, and the default save bound never cuts a longer debounce short ([049ced8](https://github.com/Surdeddd/wmkit/commit/049ced81b4c22262bd76c3a34a0f1609bc8496c3))
* **popout:** a popup aimed at another screen opens at once inside the click and moves there when the screen details arrive ([11dbe95](https://github.com/Surdeddd/wmkit/commit/11dbe95250b85239dc6747f4b0d3daef6ad5402e))
* **popout:** a repeated popout hands back the open popup even when its window cannot take the focus ([d081d91](https://github.com/Surdeddd/wmkit/commit/d081d914165e94ab2d5a299107d29a6ac7c752a0))
* **popout:** popping out a window that is already out brings its popup forward instead of opening a second, empty one ([15bb086](https://github.com/Surdeddd/wmkit/commit/15bb086fc68e84eb0901ec3ca4a72fa2a4139247))
* **qwik:** windows follow geometry prop changes and accept function options under SSR ([6d13d0d](https://github.com/Surdeddd/wmkit/commit/6d13d0d3ce49cf19e88cf988428a857c1b456b31))
* **site:** stop publishing the pages that only the end-to-end tests use ([ab5e5f9](https://github.com/Surdeddd/wmkit/commit/ab5e5f938ce76d99090eec087df102fb640974fe))
* **site:** the landing gets a Russian page at /ru/ that search engines can index, and a link preview card ([602a861](https://github.com/Surdeddd/wmkit/commit/602a861ce70c23451bf6c69dc2c3db8d3233ba4a))
* **site:** the landing quotes the size the core has now, under 19 kB instead of under 16 ([eb0458e](https://github.com/Surdeddd/wmkit/commit/eb0458e4d341a92240852bbb87f9f3bdf6065e9a))
* **site:** the landing sums up many windows changed at once for screen readers in Russian too ([f3494d7](https://github.com/Surdeddd/wmkit/commit/f3494d79a9ab98ba6db3b34960ade3846be7ad36))
* **site:** the landing's framework snippets render their window only while it exists ([50db89d](https://github.com/Surdeddd/wmkit/commit/50db89df2a183b1f1d2b7e79889139c09dc08e8a))
* **svelte:** windows stay bound when the desktop element is replaced ([5e93f4c](https://github.com/Surdeddd/wmkit/commit/5e93f4c00351f931f93daf1c033f8307c3cda52e))
* **templates:** the dashboard's Reset layout puts every panel back in its place, retro gets its title bar, and Float keeps a panel floating on touch ([c78d320](https://github.com/Surdeddd/wmkit/commit/c78d320abeae77621aeec17c591046a40a4f0ccf))
* **types:** export GroupingOptions, StackingOptions and AnimationOptions from the package entry ([973654c](https://github.com/Surdeddd/wmkit/commit/973654c4e514999db9ab9573902377fe27ea84b4))
* **winbox:** a hidden window refuses the focus, so focusing it can no longer erase the hide from the undo history ([aab08de](https://github.com/Surdeddd/wmkit/commit/aab08de86293cb6013cada80789e4d3041dc09b0))
* **winbox:** a torn-down desktop stops listening to its old manager, so its windows cannot disturb a new box with the same id ([bfa3840](https://github.com/Surdeddd/wmkit/commit/bfa384027aeb9f0442478c4fa9380b83b5c6c99b))
* **winbox:** closing the last window removes its desktop and page listeners, unless the app holds its manager ([05c4c01](https://github.com/Surdeddd/wmkit/commit/05c4c015f4593fd67a81b6c05c68bc8ead0a2140))
* **winbox:** control buttons work from the keyboard, and a hidden window no longer takes focus ([18ebf32](https://github.com/Surdeddd/wmkit/commit/18ebf3254c5877db75265b3ea50b8b30894b2ef2))
* **winbox:** passing the focus on from a hidden window no longer records an undo step or clears redo ([0655c6e](https://github.com/Surdeddd/wmkit/commit/0655c6eeea2ed13a7aad1c3445a51ba069f67e39))
* **winbox:** require() of the winbox entry returns the WinBox constructor ([43070f9](https://github.com/Surdeddd/wmkit/commit/43070f93eea16d3ee18f15ba4ee20337e2006df9))
* **winbox:** the max and min classes and every callback follow undo and redo, and onmove and onresize report each real change of geometry ([fc7d678](https://github.com/Surdeddd/wmkit/commit/fc7d6787486f2dd9ebfc7c4e723a3e45df94fbeb))
* **winbox:** undo, redo or a restored layout no longer bring back an empty window for a box that was closed ([091c603](https://github.com/Surdeddd/wmkit/commit/091c603cb4d593dfd0c6bf85ec8a803c4d2ad641))


### Features

* **dock:** a float option decides when a dragged window stays floating, so touch screens without Shift can keep a panel out of the layout ([bb9514a](https://github.com/Surdeddd/wmkit/commit/bb9514a9642b5a09a58afc2310a31b5a8323fdb6))
* **dom:** hand drop targets the pointer in desktop coordinates so they need no layout reads ([3709003](https://github.com/Surdeddd/wmkit/commit/37090038d1fbf1784302f72cdd221ef0d50bb4fd))
* **dom:** mark windows deep in the stack with data-wm-deep so themes can drop their blur ([b2da853](https://github.com/Surdeddd/wmkit/commit/b2da853cf0e109683a2f60e80787bb461c7100aa))
* **dom:** mark windows with data-wm-live while the desktop resizes so they follow it without lag ([29f4e50](https://github.com/Surdeddd/wmkit/commit/29f4e509c89ec1412ad04573ae2b25eda961b806))
* **dom:** switch tabs of a group with Ctrl or Cmd + Alt + PageUp and PageDown ([18bccd4](https://github.com/Surdeddd/wmkit/commit/18bccd472da9607a008f46a7384a498ced573b52))
* **elements:** a window in a tab group shows a tab strip for switching between its tabs ([d58542d](https://github.com/Surdeddd/wmkit/commit/d58542d3ed44b562e81d0b898266e2f3df8c43f1))
* **elements:** the window's content box carries the data-wm-content hook so theme styles can reach it ([0fe2cf7](https://github.com/Surdeddd/wmkit/commit/0fe2cf76277b5c458476faa3d348b56f8acc7441))
* **elements:** wm-desktop takes a styles property that brings a theme's titlebar and buttons into every window ([00173df](https://github.com/Surdeddd/wmkit/commit/00173df593e60986c625ca3a643223ebda14bc5e))
* **persist:** failed loads, migrations and saves are reported through a new onError option instead of throwing or vanishing ([8703ec1](https://github.com/Surdeddd/wmkit/commit/8703ec15fbf285c627af5109ad7ab69bd4dab57a))
* **themes:** a shadow theme styles the content box of a web component, and retro keeps its square corners there ([d1cf9be](https://github.com/Surdeddd/wmkit/commit/d1cf9bee6ef41b8a09652f6a375728fb32ee3eab))
* **themes:** import one theme without bundling the other fifteen ([3234977](https://github.com/Surdeddd/wmkit/commit/323497705176662e432a631da40cfb7e33043ea6))


### Performance Improvements

* **core:** magnetism allocates nothing per target and snaps a drag frame about twice as fast ([7989110](https://github.com/Surdeddd/wmkit/commit/7989110d9635ef0cf9716691b4ef2507032cd207))
* **devtools:** the panel repaints at most once per frame and adds new log lines instead of rebuilding the whole log ([e833500](https://github.com/Surdeddd/wmkit/commit/e833500d70d900aa5add819d8a53c4dce68a4075))
* **dock:** panels follow a dragged separator without easing behind it, and changes elsewhere on the desktop cost the dock nothing ([54147ad](https://github.com/Surdeddd/wmkit/commit/54147add765f687082867f44c70fc205aa560213))
* **dom:** decide a click under a modal from the synced state instead of reading every window ([c768cc3](https://github.com/Surdeddd/wmkit/commit/c768cc3b35736a01735dac461af461689cdb673f))
* **dom:** find the tab group target from window bounds instead of hit-testing the page every frame ([ca8c156](https://github.com/Surdeddd/wmkit/commit/ca8c1564cefde5b6d2460a3a198aaf1559463eff))
* **dom:** magnetism reuses its edge list between drag frames instead of allocating one per frame ([8a340db](https://github.com/Surdeddd/wmkit/commit/8a340db567478fdb0439bd3cf5e4983ee5af2daa))
* **gestures:** touch gestures measure the desktop once per gesture instead of on every finger move ([8fbe610](https://github.com/Surdeddd/wmkit/commit/8fbe6103154d0c556f1f17efbc4bcf6e0eb1f380))
* **site:** the landing goes idle when nothing on it moves ([9ee73d9](https://github.com/Surdeddd/wmkit/commit/9ee73d9122bcbf90168e2463fa117e29b4fe4253))
* **site:** the landing script no longer carries all thirty-two theme strings ([0fc93f3](https://github.com/Surdeddd/wmkit/commit/0fc93f32d63c8859bb4852c899093038b4603e0d))
* **themes:** glass themes stop blurring behind windows buried deep in the stack ([fb0425f](https://github.com/Surdeddd/wmkit/commit/fb0425f9503806b4e30179f4acf8bc1ccfc960c5))
* **themes:** windows keep up with a browser resize or a dock separator instead of easing after it ([21e877b](https://github.com/Surdeddd/wmkit/commit/21e877b2535a3d43766a9dc6dae96310d4090164))

## [0.12.1](https://github.com/Surdeddd/wmkit/compare/v0.12.0...v0.12.1) (2026-10-25)


### Bug Fixes

* **site:** placement fields never show a size the window cannot have ([d5d39a3](https://github.com/Surdeddd/wmkit/commit/d5d39a3b6d15d5c872e1855005f6f42b2943a0c1))

# [0.12.0](https://github.com/Surdeddd/wmkit/compare/v0.11.1...v0.12.0) (2026-10-25)


### Bug Fixes

* **adapters:** React owns its nodes and survives StrictMode, Vue SSR stays live, Solid binds on mount, Angular writes untracked ([fd15f3f](https://github.com/Surdeddd/wmkit/commit/fd15f3fe8125649be949eaa304ac0d4e891d4c61))
* **chrome:** placeholders only where they cannot inject, shadow skins keep their content element ([9dfcfb3](https://github.com/Surdeddd/wmkit/commit/9dfcfb321460f2ca85404fade235fe95b3e6316e))
* **devtools:** unique ids, distinct row glyphs, honest copy result, idempotent destroy ([8f8b51b](https://github.com/Surdeddd/wmkit/commit/8f8b51b07e421fe9a98ce5fbd35040df4d5a81c7))
* **gestures:** pinch and swipe share one touch-action hub and a rebuilt window no longer jumps ([6441150](https://github.com/Surdeddd/wmkit/commit/6441150ca7dcb4625b74a4f55fa0483b2e237a81))
* **persist:** cleared layouts stay cleared, a failed restore keeps saving, the last change survives tab close ([c6d2c12](https://github.com/Surdeddd/wmkit/commit/c6d2c123216158e4715307dddaa58d517c7046c9))
* **site:** one undo step per demo action, styles before layout, Russian in Russian, and a link to the docs ([38c2035](https://github.com/Surdeddd/wmkit/commit/38c203555a1eb094b6eea4dc0429b08dbbc591d5))
* **site:** presets keep their look when the designer builds a shadow root ([22a2da4](https://github.com/Surdeddd/wmkit/commit/22a2da4702dcc23c89bf92ecf4fbd4916ea49ebb))
* **themes:** shadow flavours style slotted content and keep combinators ([2efab4c](https://github.com/Surdeddd/wmkit/commit/2efab4c3171edbac7b0884ad2c01a1c66942264a))


### Features

* **adapters:** Preact, Lit and Qwik adapters ([49353b9](https://github.com/Surdeddd/wmkit/commit/49353b9c138f6fcb6968a3efcc5e8ab4927d63dd))
* **core:** snap to any rectangle and keep plugin state in history ([d6a2350](https://github.com/Surdeddd/wmkit/commit/d6a2350ea525d9bf46b20a45541216236d2334a5))
* **dock:** dockview-style docking with split panels, tabs, separators and tear-out ([8c78ccb](https://github.com/Surdeddd/wmkit/commit/8c78ccb51c528d9a4f92e944e5b87a85ac1e0ce6))
* **dom:** drop targets for window drags, and a click inside a frame raises its window ([2f7c290](https://github.com/Surdeddd/wmkit/commit/2f7c2900fa732e401abac0e151deebb2932ede82))
* **elements:** <wm-desktop> and <wm-window> web components with their own chrome, events and labels in two languages ([7c1b996](https://github.com/Surdeddd/wmkit/commit/7c1b9963961cf863c7427329347ce9d963e495d0))
* **popout:** pop a window out to picture-in-picture or a popup on any monitor ([3310d31](https://github.com/Surdeddd/wmkit/commit/3310d314dee98be8b7bf412a7ddaa74673e279d3))
* **templates:** an operations dashboard on web components and the dock ([7ea18c4](https://github.com/Surdeddd/wmkit/commit/7ea18c4bf301fa1185feab8bfe23934588652b5e))
* **winbox:** a WinBox.js-compatible entry, migrate with one import ([59780d6](https://github.com/Surdeddd/wmkit/commit/59780d6a7477c6ac5dc51e1a96f7689fe78d639f))

## [0.11.1](https://github.com/Surdeddd/wmkit/compare/v0.11.0...v0.11.1) (2026-08-20)


### Bug Fixes

* **site:** the window's text belongs in the markup ([299a9b5](https://github.com/Surdeddd/wmkit/commit/299a9b558b738f35d8a3ec03c66aa7d8165c98a7))

# [0.11.0](https://github.com/Surdeddd/wmkit/compare/v0.10.0...v0.11.0) (2026-08-20)


### Features

* **site:** grow the builder into a window designer ([e4b6cb8](https://github.com/Surdeddd/wmkit/commit/e4b6cb8651a6430b86477e7b475d11f4c72bbf26))

# [0.10.0](https://github.com/Surdeddd/wmkit/compare/v0.9.2...v0.10.0) (2026-08-20)


### Bug Fixes

* **dom:** find a shadow window's titlebar by geometry, not by elementFromPoint ([ef9a214](https://github.com/Surdeddd/wmkit/commit/ef9a2140aa6ac0accd94c9eb7ff67f7df582b77e))
* **dom:** make a shadow window answer its own chrome ([8fb03fd](https://github.com/Surdeddd/wmkit/commit/8fb03fdd88eeabd430c2cc2ebba4a059444b3f9a))
* **dom:** six ways a mounted window came apart ([5f5394b](https://github.com/Surdeddd/wmkit/commit/5f5394b764d995da643dd971c29d4a95f313bf0a))
* **site:** switch themes without a frame of no theme at all ([1f94b33](https://github.com/Surdeddd/wmkit/commit/1f94b33afcb4cb6b08c3e1155d6a8ac840b4cd87))


### Features

* **site:** put the skin constructor in the hero, and label what it builds ([7a54009](https://github.com/Surdeddd/wmkit/commit/7a54009d044bff4912977b92dccdece811c3801c))
* **site:** put the window builder on the page itself ([9649c79](https://github.com/Surdeddd/wmkit/commit/9649c79ba68c54b35e3566aea1f850e670482226))

## [0.9.2](https://github.com/Surdeddd/wmkit/compare/v0.9.1...v0.9.2) (2026-08-20)


### Bug Fixes

* **site:** stop the desktop from covering the landing copy, and settle the contrast gate ([9c0364d](https://github.com/Surdeddd/wmkit/commit/9c0364d84bd458e7049242cde3bf8d64e919a06c))
* **themes:** make every shipped theme readable, and measure it from now on ([98ebc91](https://github.com/Surdeddd/wmkit/commit/98ebc91ba51e3de4e962803728a7f7a104e79110))

## [0.9.1](https://github.com/Surdeddd/wmkit/compare/v0.9.0...v0.9.1) (2026-08-19)


### Bug Fixes

* **site:** lead the skins app with the constructor instead of burying it ([aebe480](https://github.com/Surdeddd/wmkit/commit/aebe480494ecd7812dfb1f55968f4f70f37ba811))

# [0.9.0](https://github.com/Surdeddd/wmkit/compare/v0.8.0...v0.9.0) (2026-08-19)


### Bug Fixes

* **dom:** rebuild a window outside the sync pass and unregister it before releasing ([881f2fe](https://github.com/Surdeddd/wmkit/commit/881f2feeeb2c52ce1e6ebc5c53ad9acc94c9369c))
* **themes:** make a shipped theme actually usable inside a shadow root ([a71495f](https://github.com/Surdeddd/wmkit/commit/a71495f5d74e40508c79f131269ea9d5895dc6ea))


### Features

* **chrome:** build a window from a template string ([068bf61](https://github.com/Surdeddd/wmkit/commit/068bf61362adcd78054aa8693dd6f7dd0381727e))
* **chrome:** isolate a skin in a shadow root without losing grouping, focus or the accessible name ([e063c15](https://github.com/Surdeddd/wmkit/commit/e063c15bc6b34ef709627709ae2230a3f2bf7fe9))
* **dom:** drive snap, restore, centre, back and workspace from window attributes ([16c9932](https://github.com/Surdeddd/wmkit/commit/16c9932874ac8541ecd9e6b67f1ba249588e2032))
* **dom:** expose the window actions as a typed object ([96dfed0](https://github.com/Surdeddd/wmkit/commit/96dfed0fc736327dfe068065dd5c9248c08946c2))
* **dom:** keep the title node in step with the window title ([3f7d876](https://github.com/Surdeddd/wmkit/commit/3f7d876c48d6dbd6a1405c15df69753fc2dcc0f5))
* **dom:** mount a window from a skin and rebuild it when the skin changes ([590af92](https://github.com/Surdeddd/wmkit/commit/590af92d9825d01c6bebd89e8184dea945602801))
* **site:** build a window skin in the demo ([63394c8](https://github.com/Surdeddd/wmkit/commit/63394c84aff6f9525e7d23e374d43a9a954f85bd))

# [0.8.0](https://github.com/Surdeddd/wmkit/compare/v0.7.2...v0.8.0) (2026-08-14)


### Bug Fixes

* **build:** declare the new subpaths for node10 type resolution ([cff9fc6](https://github.com/Surdeddd/wmkit/commit/cff9fc61e167a8e6061499adef7ee2ee5282784e))


### Features

* **devtools:** ship a panel that shows what the manager is doing ([8f69320](https://github.com/Surdeddd/wmkit/commit/8f6932031eebafdf636298ea298a04b9650c5e1e))
* **dom:** pinch a window to resize it and swipe two fingers to change workspace ([c27feab](https://github.com/Surdeddd/wmkit/commit/c27feab42fb0e4edb0036a8f00cd04734f1a1b49))
* **themes:** dress a single window with a variant and ship thirteen more themes ([ab00797](https://github.com/Surdeddd/wmkit/commit/ab0079797acf94dbb8ce2917323053152c3e2da5))

## [0.7.2](https://github.com/Surdeddd/wmkit/compare/v0.7.1...v0.7.2) (2026-08-14)


### Bug Fixes

* **adapters:** let an element bind again when its window comes back ([6dcae7a](https://github.com/Surdeddd/wmkit/commit/6dcae7a99aca3e3f42cf4d15724b911bd242cc03))

## [0.7.1](https://github.com/Surdeddd/wmkit/compare/v0.7.0...v0.7.1) (2026-08-14)


### Bug Fixes

* **dom:** keep the rendered desktop in step with the state it renders ([64a85d6](https://github.com/Surdeddd/wmkit/commit/64a85d6ace6f3304aa9f7dd9da9150059dc49374))

# [0.7.0](https://github.com/Surdeddd/wmkit/compare/v0.6.1...v0.7.0) (2026-08-14)


### Features

* **core:** give a tab group a real tab order with moveTab and cycleTab ([862dd42](https://github.com/Surdeddd/wmkit/commit/862dd429ba8dae88e2593c7e8989237210c31511))

## [0.6.1](https://github.com/Surdeddd/wmkit/compare/v0.6.0...v0.6.1) (2026-08-13)


### Bug Fixes

* **site:** hide the boot overlay instead of only fading it out ([bc32e7a](https://github.com/Surdeddd/wmkit/commit/bc32e7a1c9d657ee0a1b4e21d798c12dba79c94d))

# [0.6.0](https://github.com/Surdeddd/wmkit/compare/v0.5.1...v0.6.0) (2026-08-13)


### Bug Fixes

* **core:** size a tab group's frame for every member, not just the one that moved ([306887f](https://github.com/Surdeddd/wmkit/commit/306887f8a3d27bc293ea0d8374c46b55d4680da6))
* **site:** compose the demo for every width instead of only the widest ([511d852](https://github.com/Surdeddd/wmkit/commit/511d8521673bc9d0faacdacd10191de26a169225))


### Features

* **dom:** make the desktop configurable and fix what the themes hid ([0993f2f](https://github.com/Surdeddd/wmkit/commit/0993f2f06d79ecc50a392f15d0964db47a37bc84))


### Performance Improvements

* make stacking and bulk operations scale to large desktops ([04c2909](https://github.com/Surdeddd/wmkit/commit/04c290931fb0a0bc1fa89a4f748f417aeb683c4e))

## [0.5.1](https://github.com/Surdeddd/wmkit/compare/v0.5.0...v0.5.1) (2026-07-31)


### Bug Fixes

* **groups:** close the tab group defects found by the third audit wave ([97b3f22](https://github.com/Surdeddd/wmkit/commit/97b3f2255fb5a4bfcc8625dfad8e73c3863f5320))

# [0.5.0](https://github.com/Surdeddd/wmkit/compare/v0.4.2...v0.5.0) (2026-07-31)


### Features

* tab groups — several windows sharing one frame ([c4900aa](https://github.com/Surdeddd/wmkit/commit/c4900aac412084c4a566c31aecd105d3e2080504))

## [0.4.2](https://github.com/Surdeddd/wmkit/compare/v0.4.1...v0.4.2) (2026-07-31)


### Bug Fixes

* repair 32 defects found by a second audit of the 0.4 code ([3eef29b](https://github.com/Surdeddd/wmkit/commit/3eef29b810271ce922ff6f9b6561bd18ba447941))

## [0.4.1](https://github.com/Surdeddd/wmkit/compare/v0.4.0...v0.4.1) (2026-07-26)


### Bug Fixes

* **dom:** stop a header drag handle from leaking a banner landmark, and document the platform contract ([3fa22ac](https://github.com/Surdeddd/wmkit/commit/3fa22acc8b889b435f3b1bba5b52f4284305361b))

# [0.4.0](https://github.com/Surdeddd/wmkit/compare/v0.3.0...v0.4.0) (2026-07-26)


### Features

* workspaces, snap thirds, aspect ratio lock, keyboard snap and history shortcuts, versioned persistence, rebuilt demo ([64fa225](https://github.com/Surdeddd/wmkit/commit/64fa22548e9975222412ed62c31749b317c096d9))

# [0.3.0](https://github.com/Surdeddd/wmkit/compare/v0.2.0...v0.3.0) (2026-07-18)


### Features

* window magnetism, undo/redo history, named layouts, arrange commands, Angular adapter, reverse FLIP restore, light and retro themes, titlebar context menu hook, perf benchmarks in CI, visual regression baselines ([b99ae0d](https://github.com/Surdeddd/wmkit/commit/b99ae0d8e70a61fb4a4f6da31d110babf9cb6681))

# [0.2.0](https://github.com/Surdeddd/wmkit/compare/v0.1.1...v0.2.0) (2026-07-17)


### Features

* **dom:** adaptive touch hit areas, removeOnClose attach option, per-session rect caching and will-change ([5b3e236](https://github.com/Surdeddd/wmkit/commit/5b3e23624f014f9f23ce00c16ce388ee9a1e79d7))

## [0.1.1](https://github.com/Surdeddd/wmkit/compare/v0.1.0...v0.1.1) (2026-07-13)


### Bug Fixes

* **core:** atomic state transactions, id generation after hydrate, Infinity-safe max size serialization, modal focus on hydrate/promote, full stage restore on drag cancel ([8059de6](https://github.com/Surdeddd/wmkit/commit/8059de6f22f93808c00100743fe171b145f9958e))

# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/). Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) — every push to main with releasable commits publishes to npm.

## 0.1.0 — 2026-07-10

### Added

- Headless window manager core: serializable state machine with open/close/focus, z-order layers (`normal`/`floating`/`modal`), stages (`normal`/`minimized`/`maximized`/`snapped`), viewport clamping, cascade positioning, batch transactions and granular events
- DOM controller: pointer-capture drag (mouse/touch/pen), 8-direction resize, snap zones with live preview and drag-to-top maximize, Escape cancellation, keyboard move/resize, F6 window cycling, modal focus trap, ARIA roles and `aria-live` announcements, FLIP minimize-to-taskbar animation
- Framework adapters: `@surdeddd/wmkit/react` (hooks on `useSyncExternalStore`), `@surdeddd/wmkit/vue` (composables), `@surdeddd/wmkit/svelte` (stores + actions), `@surdeddd/wmkit/solid` (signals)
- `@surdeddd/wmkit/persist`: pluggable storage persistence with debounce, safe probing and auto-restore
- `@surdeddd/wmkit/popout` *(experimental)*: Document Picture-in-Picture tear-off sharing manager state
- Glass theme (`@surdeddd/wmkit/themes/glass.css`) driven by CSS variables, `prefers-reduced-motion` aware
- Test suite: 121 unit tests with 100% coverage of the core and persistence; 160+ Playwright scenarios across Chromium, WebKit and mobile emulation including touch, stress and axe accessibility audits
- Bilingual (EN/RU) landing page with a live wmkit desktop, deployed via GitHub Pages
