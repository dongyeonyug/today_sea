## 무엇을 · 왜

<!-- 무엇을 바꿨고, 왜 필요했는지. 이슈가 있으면 링크. -->

## 안전 불변조건

이 앱은 "지금 물에 들어가도 되는가"에 답한다. 잘못된 `가능` 하나가 사람을 다치게 하므로,
아래는 리뷰어가 아니라 **작성자가 직접 확인**한다. 해당 없는 항목은 `~~취소선~~` 대신
`N/A` 사유를 한 줄 적을 것.

- [ ] **보수적 판정 유지** — `combineStatus`는 여전히 가장 위험한 등급을 채택한다. `데이터없음`/`점검중`을 추측으로 메우거나 `가능`으로 떨어뜨리지 않았다. ([lib/engine/types.ts](../lib/engine/types.ts))
- [ ] **챗봇이 판정을 뒤집을 수 없다** — `/api/chat`은 클라이언트가 보낸 `Verdict`를 믿지 않고 서버에서 `evaluate()`를 다시 돌린다. `불가`일 때의 hard stop 문구가 살아 있다. ([lib/chat/prompt.ts](../lib/chat/prompt.ts))
- [ ] **키가 서버 밖으로 나가지 않는다** — `ANTHROPIC_API_KEY`·`DATA_GO_KR_SERVICE_KEY`를 라우트 핸들러/`lib/sources`/`lib/claude` 밖에서 읽지 않는다. 클라이언트 컴포넌트에서 외부 API를 직접 호출하지 않는다.
- [ ] **지점 화이트리스트 원칙 유지** — [data/stations.ts](../data/stations.ts)에는 그 활동에 필요한 신호가 *전부* 실데이터로 나오는 지점만 있다. 부분 지원으로 추가하지 않았다.
- [ ] **임계값을 바꿨다면 근거를 남겼다** — 파고·수온·간조 창 등의 수치를 조정했다면 해당 ADR([docs/adr/](../docs/adr/))을 함께 갱신했다.

## 검증

CI가 자동으로 도는 것 — lint · typecheck · 문서 링크 · 빌드.

실 API를 호출하는 검증은 시크릿이 필요해 CI에 없다. **해당하면 로컬에서 돌리고 출력을 붙일 것:**

- [ ] `lib/engine/` 또는 `lib/sources/` 수정 → `npm run verify:verdict`
- [ ] `lib/chat/prompt.ts` 수정 → `npm run verify:chat`
- [ ] 외부 API 응답이 바뀐 것 같을 때 → `npm run verify:sources`

<details>
<summary>실행 결과</summary>

```
(여기에 붙여넣기)
```

</details>
