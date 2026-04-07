1:"$Sreact.fragment"
2:I[1402,["970","static/chunks/970-ea9ca042f8e77c8f.js","375","static/chunks/375-6409a95e768592f4.js","743","static/chunks/743-894ccd24be4d5d2f.js","923","static/chunks/923-54c0828fb75b7875.js","802","static/chunks/802-3dbc9fa8c5a98284.js","177","static/chunks/app/layout-fa0bcce4e729911b.js"],""]
4:I[7293,["970","static/chunks/970-ea9ca042f8e77c8f.js","375","static/chunks/375-6409a95e768592f4.js","743","static/chunks/743-894ccd24be4d5d2f.js","923","static/chunks/923-54c0828fb75b7875.js","802","static/chunks/802-3dbc9fa8c5a98284.js","177","static/chunks/app/layout-fa0bcce4e729911b.js"],"AppProviders"]
5:I[8553,["970","static/chunks/970-ea9ca042f8e77c8f.js","375","static/chunks/375-6409a95e768592f4.js","743","static/chunks/743-894ccd24be4d5d2f.js","923","static/chunks/923-54c0828fb75b7875.js","802","static/chunks/802-3dbc9fa8c5a98284.js","177","static/chunks/app/layout-fa0bcce4e729911b.js"],"AppRuntime"]
6:I[8114,["970","static/chunks/970-ea9ca042f8e77c8f.js","375","static/chunks/375-6409a95e768592f4.js","743","static/chunks/743-894ccd24be4d5d2f.js","923","static/chunks/923-54c0828fb75b7875.js","802","static/chunks/802-3dbc9fa8c5a98284.js","177","static/chunks/app/layout-fa0bcce4e729911b.js"],"AppShell"]
7:I[9766,[],""]
8:I[8924,[],""]
c:I[7150,[],""]
:HL["/_next/static/css/4b6016b7dc63d878.css","style"]
3:T581,
  (function () {
    var shouldRemove = function (name) {
      return (
        name === 'bis_skin_checked' ||
        name === 'data--h-bstatus' ||
        name === 'data-new-gr-c-s-check-loaded' ||
        name === 'data-gr-ext-installed' ||
        name.indexOf('data--h-') === 0 ||
        name.indexOf('bis_') === 0 ||
        name.indexOf('__processed_') === 0
      );
    };

    var scrubNode = function (node) {
      if (!node || node.nodeType !== 1) return;

      Array.prototype.slice.call(node.attributes || []).forEach(function (attribute) {
        if (shouldRemove(attribute.name)) {
          node.removeAttribute(attribute.name);
        }
      });

      Array.prototype.slice.call(node.children || []).forEach(scrubNode);
    };

    scrubNode(document.documentElement);

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName && shouldRemove(mutation.attributeName)) {
          mutation.target.removeAttribute(mutation.attributeName);
        }

        Array.prototype.slice.call(mutation.addedNodes || []).forEach(scrubNode);
      });
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true
    });

    window.setTimeout(function () {
      observer.disconnect();
    }, 4000);
  })();
0:{"P":null,"b":"mbQk0JkVHLt38XIquV0la","p":"","c":["","_not-found"],"i":false,"f":[[["",{"children":["/_not-found",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/4b6016b7dc63d878.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]],["$","html",null,{"lang":"ar","dir":"rtl","suppressHydrationWarning":true,"children":["$","body",null,{"suppressHydrationWarning":true,"className":"__variable_cb7040 __variable_338cf8","data-theme":"mint","children":[["$","$L2",null,{"id":"seo-website-schema","type":"application/ld+json","strategy":"beforeInteractive","children":"{\"@context\":\"https://schema.org\",\"@type\":\"WebSite\",\"name\":\"Quranic Pomodoro\",\"description\":\"تطبيق عربي يدمج جلسات التركيز مع قراءة القرآن الكريم وتفسير الآيات في تجربة هادئة وسريعة.\",\"url\":\"http://127.0.0.1:4000\",\"inLanguage\":\"ar\"}"}],["$","$L2",null,{"id":"seo-webapp-schema","type":"application/ld+json","strategy":"beforeInteractive","children":"{\"@context\":\"https://schema.org\",\"@type\":\"WebApplication\",\"name\":\"Quranic Pomodoro\",\"description\":\"تطبيق عربي يدمج جلسات التركيز مع قراءة القرآن الكريم وتفسير الآيات في تجربة هادئة وسريعة.\",\"applicationCategory\":\"EducationalApplication\",\"operatingSystem\":\"Web\",\"inLanguage\":\"ar\",\"url\":\"http://127.0.0.1:4000\",\"offers\":{\"@type\":\"Offer\",\"price\":\"0\",\"priceCurrency\":\"USD\"}}"}],["$","$L2",null,{"id":"hydration-attribute-cleanup","strategy":"beforeInteractive","children":"$3"}],["$","$L4",null,{"children":[["$","$L5",null,{}],["$","$L6",null,{"children":["$","$L7",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L8",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]}]]}]]}]}]]}],{"children":["/_not-found",["$","$1","c",{"children":[null,["$","$L7",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L8",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}],{"children":["__PAGE__",["$","$1","c",{"children":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":"$L9"}]],null,"$La"]}],{},null,false]},null,false]},null,false],"$Lb",false]],"m":"$undefined","G":["$c",[]],"s":false,"S":true}
d:I[4431,[],"OutletBoundary"]
f:I[5278,[],"AsyncMetadataOutlet"]
11:I[4431,[],"ViewportBoundary"]
13:I[4431,[],"MetadataBoundary"]
14:"$Sreact.suspense"
9:["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]
a:["$","$Ld",null,{"children":["$Le",["$","$Lf",null,{"promise":"$@10"}]]}]
b:["$","$1","h",{"children":[["$","meta",null,{"name":"robots","content":"noindex"}],[["$","$L11",null,{"children":"$L12"}],null],["$","$L13",null,{"children":["$","div",null,{"hidden":true,"children":["$","$14",null,{"fallback":null,"children":"$L15"}]}]}]]}]
12:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
e:null
10:{"metadata":[["$","title","0",{"children":"Quranic Pomodoro | تركيز وقراءة وتفسير"}],["$","meta","1",{"name":"description","content":"تطبيق عربي يدمج جلسات التركيز مع قراءة القرآن الكريم وتفسير الآيات في تجربة هادئة وسريعة."}],["$","meta","2",{"name":"application-name","content":"Quranic Pomodoro"}],["$","meta","3",{"name":"keywords","content":"Quranic Pomodoro,القرآن الكريم,تطبيق قرآن,تفسير القرآن,مؤقت بومودورو,Pomodoro,Quran reader,Tafsir"}],["$","meta","4",{"name":"robots","content":"index, follow"}],["$","meta","5",{"name":"googlebot","content":"index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1"}],["$","link","6",{"rel":"canonical","href":"http://127.0.0.1:4000"}],["$","meta","7",{"property":"og:title","content":"Quranic Pomodoro | تركيز وقراءة وتفسير"}],["$","meta","8",{"property":"og:description","content":"تطبيق عربي يدمج جلسات التركيز مع قراءة القرآن الكريم وتفسير الآيات في تجربة هادئة وسريعة."}],["$","meta","9",{"property":"og:url","content":"http://127.0.0.1:4000"}],["$","meta","10",{"property":"og:site_name","content":"Quranic Pomodoro"}],["$","meta","11",{"property":"og:locale","content":"ar_SA"}],["$","meta","12",{"property":"og:type","content":"website"}],["$","meta","13",{"name":"twitter:card","content":"summary"}],["$","meta","14",{"name":"twitter:title","content":"Quranic Pomodoro | تركيز وقراءة وتفسير"}],["$","meta","15",{"name":"twitter:description","content":"تطبيق عربي يدمج جلسات التركيز مع قراءة القرآن الكريم وتفسير الآيات في تجربة هادئة وسريعة."}]],"error":null,"digest":"$undefined"}
15:"$10:metadata"
