// AU, periods, radii and inclinations are reference data. display* values are
// configurable presentation scales, not a physical scale or final game balance.
export const EPOCH = '2200-01-01T00:00:00Z';
export const BASE_DAYS_PER_SECOND = 0.18;
export const SUN = { id: 'sun', name: '태양', english: 'SUN', type: 'G2V · 황색 주계열성', color: '#f7be65', radius: 3.4, realRadius: 696340, description: '모항성계의 중심. 여덟 행성과 수많은 작은 천체가 이 황색 항성 주위를 공전합니다.' };
export const PLANETS = [
  { id: 'mercury', name: '수성', english: 'MERCURY', type: '암석형 행성', color: '#b8afa4', radius: .48, realRadius: 2439.7, au: .387, orbit: 10, period: 87.97, eccentricity: .2056, inclination: 7, node: 48.3, phase: 215, spinHours: 1407.6, description: '태양에 가장 가까운 작은 암석 행성. 크레이터로 덮인 표면과 기울어진 궤도를 가지고 있습니다.' },
  { id: 'venus', name: '금성', english: 'VENUS', type: '암석형 행성', color: '#dbb97d', radius: .78, realRadius: 6051.8, au: .723, orbit: 15.5, period: 224.7, eccentricity: .0068, inclination: 3.39, node: 76.7, phase: 305, spinHours: -5832.5, description: '두꺼운 구름에 둘러싸인 암석 행성. 천천히 자전하며 다른 대부분의 행성과 반대 방향으로 회전합니다.' },
  { id: 'earth', name: '지구', english: 'EARTH', type: '암석형 행성 · 모행성', color: '#7fb9f4', radius: .86, realRadius: 6371, au: 1, orbit: 22, period: 365.256, eccentricity: .0167, inclination: 0, node: 0, phase: 68, spinHours: 23.93, description: '푸른 바다와 대륙, 얇은 대기를 가진 모행성. 달과 함께 태양 주위를 공전합니다.' },
  { id: 'mars', name: '화성', english: 'MARS', type: '암석형 행성', color: '#d88664', radius: .64, realRadius: 3389.5, au: 1.524, orbit: 29, period: 686.98, eccentricity: .0934, inclination: 1.85, node: 49.6, phase: 165, spinHours: 24.62, description: '산화철로 붉게 물든 차가운 암석 행성. 두 개의 작은 위성 포보스와 데이모스를 거느립니다.' },
  { id: 'jupiter', name: '목성', english: 'JUPITER', type: '가스형 거대 행성', color: '#d3b699', radius: 2.5, realRadius: 69911, au: 5.203, orbit: 46, period: 4332.59, eccentricity: .0489, inclination: 1.3, node: 100.5, phase: 330, spinHours: 9.93, description: '태양계에서 가장 큰 행성. 줄무늬 구름층과 대적점, 갈릴레이 위성들이 작은 행성계 같은 풍경을 만듭니다.' },
  { id: 'saturn', name: '토성', english: 'SATURN', type: '가스형 거대 행성', color: '#dfc99d', radius: 2.1, realRadius: 58232, au: 9.537, orbit: 64, period: 10759.22, eccentricity: .0565, inclination: 2.49, node: 113.7, phase: 126, spinHours: 10.66, description: '얼음과 암석 입자로 이루어진 넓은 고리를 가진 거대 행성. 타이탄과 엔셀라두스가 주변을 공전합니다.' },
  { id: 'uranus', name: '천왕성', english: 'URANUS', type: '얼음형 거대 행성', color: '#a2d5d7', radius: 1.35, realRadius: 25362, au: 19.19, orbit: 82, period: 30688.5, eccentricity: .0457, inclination: .77, node: 74, phase: 241, spinHours: -17.24, description: '청록색 대기를 가진 얼음 거대 행성. 크게 기울어진 자전축이 특징입니다.' },
  { id: 'neptune', name: '해왕성', english: 'NEPTUNE', type: '얼음형 거대 행성', color: '#6489df', radius: 1.3, realRadius: 24622, au: 30.07, orbit: 99, period: 60182, eccentricity: .0113, inclination: 1.77, node: 131.8, phase: 37, spinHours: 16.11, description: '태양계 바깥쪽의 짙푸른 거대 행성. 긴 공전 주기로 항성계를 천천히 돌고 있습니다.' },
];
export const MOONS = [
  { id: 'moon', name: '달', english: 'MOON', parent: 'earth', color: '#c6c7c4', radius: .24, realRadius: 1737.4, orbit: 2.6, period: 27.32, inclination: 5.14, node: 125, phase: 120 },
  { id: 'phobos', name: '포보스', english: 'PHOBOS', parent: 'mars', color: '#a89b8f', radius: .12, realRadius: 11.1, orbit: 1.35, period: .319, inclination: 1.1, phase: 20 },
  { id: 'deimos', name: '데이모스', english: 'DEIMOS', parent: 'mars', color: '#b6aca1', radius: .09, realRadius: 6.2, orbit: 2.0, period: 1.263, inclination: 1.8, phase: 180 },
  { id: 'io', name: '이오', english: 'IO', parent: 'jupiter', color: '#dcc37a', radius: .22, realRadius: 1821.6, orbit: 3.6, period: 1.769, inclination: .05, phase: 25 },
  { id: 'europa', name: '유로파', english: 'EUROPA', parent: 'jupiter', color: '#d6cfc0', radius: .20, realRadius: 1560.8, orbit: 4.6, period: 3.551, inclination: .47, phase: 155 },
  { id: 'ganymede', name: '가니메데', english: 'GANYMEDE', parent: 'jupiter', color: '#a99e91', radius: .31, realRadius: 2634.1, orbit: 5.9, period: 7.155, inclination: .2, phase: 260 },
  { id: 'callisto', name: '칼리스토', english: 'CALLISTO', parent: 'jupiter', color: '#92887c', radius: .29, realRadius: 2410.3, orbit: 7.2, period: 16.689, inclination: .28, phase: 330 },
  { id: 'titan', name: '타이탄', english: 'TITAN', parent: 'saturn', color: '#d6ae61', radius: .31, realRadius: 2574.7, orbit: 6.0, period: 15.945, inclination: 27, phase: 100 },
  { id: 'enceladus', name: '엔셀라두스', english: 'ENCELADUS', parent: 'saturn', color: '#e5e7e8', radius: .14, realRadius: 252.1, orbit: 4.5, period: 1.37, inclination: 27, phase: 240 },
  { id: 'titania', name: '티타니아', english: 'TITANIA', parent: 'uranus', color: '#b4b9b8', radius: .18, realRadius: 788.9, orbit: 3.2, period: 8.706, inclination: 98, phase: 180 },
  { id: 'triton', name: '트리톤', english: 'TRITON', parent: 'neptune', color: '#c5c5c3', radius: .2, realRadius: 1353.4, orbit: 3.2, period: -5.877, inclination: 156.8, phase: 45 },
].map(m => ({ ...m, eccentricity: .01, type: '자연 위성', description: `${PLANETS.find(p => p.id === m.parent).name} 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다.` }));
export const BELTS = [
  { id: 'asteroid-belt', name: '소행성대', english: 'ASTEROID BELT', type: '소천체 밀집 영역', color: '#b7a48c', inner: 35, outer: 40, count: 1800, au: '2.1–3.3', description: '화성과 목성 사이에 분포하는 암석 천체들. 폭과 수직 두께를 가진 영역으로 표현했습니다. 입자 수와 크기는 관찰을 위해 조정했습니다.' },
  { id: 'kuiper-belt', name: '카이퍼대', english: 'KUIPER BELT', type: '외곽 소천체 영역', color: '#7f96b1', inner: 111, outer: 122, count: 1400, au: '30–50', description: '해왕성 궤도 바깥의 얼음 천체 영역. 바깥 경계를 둘러싼 입체적인 띠로 표현했습니다.' },
];
export const ALL_BODIES = [SUN, ...PLANETS, ...MOONS, ...BELTS];
export const BODY_BY_ID = new Map(ALL_BODIES.map(body => [body.id, body]));
