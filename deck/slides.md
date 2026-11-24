---
theme: default
title: Slidev video starter
highlighter: shiki
lineNumbers: false
colorSchema: dark
aspectRatio: 16/9
canvasWidth: 980
transition: fade
fonts:
  sans: Inter
  mono: Fira Code
  local: Inter
clicks: 2
---

<div class="feat">Slidev · magic-move: one block morphs into another</div>

<div class="codewin">
<div class="tab"><span v-click.hide="2">deploy.sh</span><span v-click="2">delivery/index.ts</span></div>

````md magic-move {at: 2, lines: false}
```bash
# deploy.sh  (do NOT edit without asking Dave)
ENV=${1:-dev}; REGION=${2:-us-west-2}; RETRIES=${RETRIES:-3}
source ./scripts/env/${ENV}.sh || { echo "no env"; exit 2; }
if [[ "$ENV" == "prod"* ]]; then
  if [[ -z "${APPROVED_BY:-}" ]]; then echo "need approval" >&2; exit 1; fi
  for r in us-west-2 eu-west-1; do
    REGION=$r ./deploy.sh "${ENV%%-*}-${r%%-*}" "$r" || FAILED="${FAILED:-} $r"
  done
  [[ -n "${FAILED:-}" ]] && { ./rollback.sh $FAILED; exit 1; }
fi
for i in $(seq 1 $RETRIES); do
  pulumi up --stack "$ENV" --yes --skip-preview && break || sleep $((i * 10))
done
URL=$(pulumi stack output endpoint --stack "$ENV" 2>/dev/null || cat .last-url)
for i in {1..12}; do curl -fsS "$URL/health" | grep -q ok && break; sleep 5; done
# TODO: why does staging need this twice?
[[ "$ENV" == "staging" ]] && ./smoke.sh "$URL" && ./smoke.sh "$URL"
```
```ts
const dev = new delivery.Stage("dev", { pipeline });
deploy(dev, "dev", ["dev"]);

const staging = new delivery.Stage("staging", { pipeline, from: [dev] });
deploy(staging, "staging", ["staging"]);

// Production is two regions. Nothing reaches them until a named person approves.
const REGIONS = ["us", "eu"];
const prod = new delivery.Stage("prod", {
    pipeline,
    from: [staging],
    when: delivery.approval({ approvers: APPROVERS }),
});
deploy(prod, "prod", REGIONS.map(r => `prod-${r}`));
```
````

</div>

<div class="stamp" v-click="[1, 2]">✕ GLUE CODE</div>

<!--
[head] Getting a merge change into production goes through a few stages.

That used to be a [show] messy deploy script that nobody wanted to [click] touch, but Pulumi
Delivery lets me take that out of Bash and write it as [click] proper code in TypeScript and lives
right alongside my app.
-->

---
clicks: 7
---

<div class="feat">Slidev · diagram builds stage by stage, camera follows</div>

<div class="diagram"><Pipeline mode="build" :step="$clicks" /></div>

<!--
So every merge to main starts as a release. It deploys the [click] dev, and then it runs a
[click] smoke test, and then [click] staging, and then a [click] smoke test, and then I have an
[click] approval gate, and then for production, I loop over [click] two regions. It's [click] easy
to build the release process you want in Pulumi Delivery.
-->

---
clicks: 2
pip: tr
---

<Clip src="r11-start.mp4" />
<Clip src="r11-dev.mp4" at="1" />
<Clip src="r11-staging-fail.mp4" at="2" />

<!--
So now I can see [show] my change going through the pipeline. It [click] passes dev, but look,
it [click] failed in staging.
-->

---
clicks: 3
---

<div class="feat">Slidev · highlights + callouts on the same clicks</div>

<div class="codewin">
<div class="tab"><span>app/index.ts</span></div>

```ts {16|16|16|1-5}
const perf = {
    "staging": { memorySize: 512, provisionedConcurrency: 1 },
    "prod-us": { memorySize: 512, provisionedConcurrency: 1 },
    "prod-eu": { memorySize: 512, provisionedConcurrency: 1 },
};
const tuning = perf[env];

const fn = new aws.lambda.Function(name, {
    runtime: aws.lambda.Runtime.NodeJS22dX,
    ...(tuning ? { memorySize: tuning.memorySize } : {}),
});

if (tuning) {
    new aws.lambda.ProvisionedConcurrencyConfig(`${name}-warm`, {
        functionName: fn.name,
        qualifier: fn.version,
        provisionedConcurrentExecutions: tuning.provisionedConcurrency,
    });
}
```

</div>

<div class="callouts">
  <div class="callout" v-click="1">Provisioned concurrency needs a <b>published version</b></div>
  <div class="callout bad" v-click="2">✕ <code>fn.version</code> is <b>"$LATEST"</b>: nothing was published</div>
  <div class="callout" v-click="3">No <b>dev</b> row: dev never ran this code path</div>
</div>

<!--
My coding agent has [show] made a mistake. Provision concurrency actually needs a
[click] published version, and it was pointing at [click] latest. Because I wasn't using
concurrency [click] in dev, I didn't actually catch it until staging.
-->

---
clicks: 1
---

<div class="feat">Slidev · same component, different state</div>

<div class="diagram"><Pipeline mode="run" :step="$clicks" /></div>

<!--
So dev never caught it, but thankfully my [show] delivery pipeline did catch it before it got to
[click] production.
-->
