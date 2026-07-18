/**
 * 지원 지점 화이트리스트(§9).
 * 원칙: 해당 활동에 필요한 데이터가 확보되는 지점만 등록.
 * - swim(물놀이): open-meteo 좌표 + 기상특보 stnId + 이안류 + 해수욕지수
 * - mudflat(갯벌): 조석 obsCode + 갯벌체험지수 + 기상특보 stnId
 *
 * obsCode/stnId 는 M1·M2 실호출로 검증된 값(docs/verified-apis.md).
 *   · 인천 조위관측소 = DT_0001
 *   · 안산 조위관측소 = DT_0008 (126.64722, 37.19222) — 제부도 최근접 프록시(~6km)
 *   · 기상특보 stnId: 부산=159, 강릉=105, 속초=90, 보령=235,
 *     서귀포=189, 인천=112, 경기(수원)=119
 */
import type { Activity } from "../lib/engine/types";

export interface Station {
  id: string;
  name: string;
  activities: Activity[];
  /** open-meteo 파고·수온용 좌표. */
  lat: number;
  lon: number;
  /** 기상특보 지점번호. */
  warningStnId: number;
  /** 조석예보 obsCode(갯벌 필수). swim 전용 지점은 생략 가능. */
  tideObsCode?: string;
  /** 조석 관측소가 지점 본체가 아닌 프록시일 때 안내 문구. */
  tideProxyNote?: string;
  /** 이안류지수 해수욕장코드(KHOA 주요 10개소만 제공). swim 지점은 필수. */
  beachCode?: string;
  /** 갯벌체험지수는 좌표 최근접 마을로 매칭(별도 코드 불필요) — data/lat·lon 사용. */
}

export const STATIONS: Station[] = [
  {
    id: "haeundae",
    name: "해운대",
    activities: ["swim"],
    lat: 35.1587,
    lon: 129.1604,
    warningStnId: 159,
    beachCode: "HAE", // 이안류지수: 해운대 해수욕장 (실호출 검증)
  },
  {
    id: "songjeong",
    name: "송정",
    activities: ["swim"],
    lat: 35.178,
    lon: 129.199,
    warningStnId: 159,
    beachCode: "SONGJUNG", // 이안류지수: 송정 해수욕장 (실호출 검증)
  },
  {
    id: "imrang",
    name: "임랑",
    activities: ["swim"],
    lat: 35.31854,
    lon: 129.26408,
    warningStnId: 159,
    beachCode: "IMRANG", // 이안류지수: 임랑 해수욕장 (실호출 검증)
  },
  {
    id: "daecheon",
    name: "대천",
    activities: ["swim"],
    lat: 36.30555,
    lon: 126.51601,
    warningStnId: 235,
    beachCode: "DAECHON", // 이안류지수: 대천 해수욕장 (실호출 검증)
  },
  {
    id: "jungmun",
    name: "중문",
    activities: ["swim"],
    lat: 33.245,
    lon: 126.411,
    warningStnId: 189,
    beachCode: "JUNGMUN", // 이안류지수: 중문 해수욕장 (실호출 검증)
  },
  {
    id: "gyeongpo",
    name: "경포",
    activities: ["swim"],
    lat: 37.803,
    lon: 128.91,
    warningStnId: 105,
    beachCode: "GYEONGPO", // 이안류지수: 경포 해수욕장 (실호출 검증)
  },
  {
    id: "sokcho",
    name: "속초",
    activities: ["swim"],
    lat: 38.19,
    lon: 128.602,
    warningStnId: 90,
    beachCode: "SOKCHO", // 이안류지수: 속초 해수욕장 (실호출 검증)
  },
  {
    id: "jebudo",
    name: "제부도",
    activities: ["mudflat"],
    lat: 37.1463,
    lon: 126.6072,
    warningStnId: 119,
    tideObsCode: "DT_0008",
    tideProxyNote: "인근 안산 조위관측소 기준(제부도 최근접, 약 6km)",
    // 갯벌체험지수: 좌표 최근접 마을(백미리마을, 약 6km)로 매칭
  },
  {
    id: "masian",
    name: "마시안",
    activities: ["mudflat"],
    lat: 37.4314,
    lon: 126.417,
    warningStnId: 112,
    tideObsCode: "DT_0001",
    tideProxyNote: "인근 인천 조위관측소 기준(영종도 마시안 갯벌 프록시)",
    // 갯벌체험지수: 마시안마을 실호출 검증
  },
  {
    id: "seongam",
    name: "선감",
    activities: ["mudflat"],
    lat: 37.21646,
    lon: 126.63152,
    warningStnId: 119,
    tideObsCode: "DT_0008",
    tideProxyNote: "인근 안산 조위관측소 기준(선감마을 프록시)",
    // 갯벌체험지수: 선감마을 실호출 검증
  },
  {
    id: "wolhaseong",
    name: "월하성",
    activities: ["mudflat"],
    lat: 36.13162,
    lon: 126.5627,
    warningStnId: 235,
    tideObsCode: "DT_0051",
    tideProxyNote: "인근 서천마량 조위관측소 기준(월하성마을 프록시)",
    // 갯벌체험지수: 월하성마을 실호출 검증
  },
  {
    id: "byeongsulman",
    name: "병술만",
    activities: ["mudflat"],
    lat: 36.47317,
    lon: 126.34163,
    warningStnId: 235,
    tideObsCode: "DT_0025",
    tideProxyNote: "인근 보령 조위관측소 기준(병술만마을 프록시)",
    // 갯벌체험지수: 병술만마을 실호출 검증
  },
];

export function getStation(id: string): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}

export function stationsForActivity(activity: Activity): Station[] {
  return STATIONS.filter((s) => s.activities.includes(activity));
}
