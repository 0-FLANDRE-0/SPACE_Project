// UI-1 display assumptions. No economic, navigation or geological rules.
export const UI1_TUNING=Object.freeze({
 surfaceShortcutBodyRadii:1.7,surfaceExitBodyRadii:2.4,projectionEaseSeconds:.18,
 viewportMargin:14,freeRegionGap:10,warningMonths:3,refreshMs:250,
 portraitMaxWidth:600,portraitPanelHeightRatio:.5,portraitPanelBottom:68,
 landscapePanelWidthRatio:.445,landscapeTimelineMaxWidth:320,minimumTimelineWidth:160,
 distributionModes:Object.freeze([{id:'survey',label:'탐사'},{id:'ore',label:'매장량'},{id:'population',label:'인구'},{id:'facilities',label:'시설'}]),
 futureResources:Object.freeze([{id:'water',label:'물'},{id:'oxygen',label:'산소'}]),
 comparisonLabels:Object.freeze(['매우 적음','적음','평균 수준','천체 평균보다 많음'])
});
