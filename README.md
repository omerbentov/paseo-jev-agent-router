# Jev agent router for Paseo

Type `/route <task>` in a [Paseo](https://paseo.sh) workspace. The plugin asks [TypeSafe's Jev](https://typesafe.ai) which of **your** agent profiles fits the task, then starts an agent with that profile's provider, model, mode and thinking level.

```
/route Review PR #724 and flag regressions     → Developer code reviewer (0.92)
/route Plan how we add SSO to the backoffice   → Plan (1.00)
/route Run the e2e suite on the onboarding flow → Testing QA (1.00)
```

The first row of the new agent says which profile was picked and why.

## Install

You need Paseo 0.8, plugins turned on (Settings → Plugins → Enable plugins), and a TypeSafe API key.

```sh
curl -fsSL https://raw.githubusercontent.com/omerbentov/paseo-jev-agent-router/main/install.sh | bash
```

The script installs the plugin into your local Paseo daemon (or updates it), and asks for your TypeSafe key once. Run it again to update.

Or do it by hand: `paseo plugin add github:omerbentov/paseo-jev-agent-router`, then paste your key under **Settings → Plugins → Jev agent router**.

## How it chooses

- **Your profiles, read live.** Every `/route` reads the agent profiles from your daemon, so a profile you add, edit or delete is used on the next task. Nothing is hardcoded.
- **Name and notes are all Jev sees.** Give each profile a note saying when to use it (for example "When we code review a PR"). The settings screen lists the profiles that have none.
- **A confidence bar.** Below **Minimum confidence** (0.5 by default), the **Fallback profile** is used instead. With no fallback set, Jev's pick stands.
- With a single profile there is nothing to choose, so Jev is not called.

One call to Jev per task, typically 0.3–0.8 s.

## Settings

**Settings → Plugins → Jev agent router**: API key, minimum confidence, fallback profile.

They are stored on the daemon machine in `~/.config/paseo-jev-agent-router/config.json`, readable only by you. The key is never sent back to the app. `TYPESAFE_API_KEY` in the daemon's environment overrides the saved key.

## Privacy

Each `/route` sends the task text and your profile names and notes to `api.typesafe.ai`. Nothing else leaves your machine.

## Limits

- Routing happens through `/route` only. Paseo's normal **New agent** flow is not routed, because Paseo 0.8's creation hook does not include the prompt.
- Each `/route` starts a new agent. It does not reuse an existing one.

## Uninstall

```sh
paseo plugin remove jev-agent-router
rm -rf ~/.config/paseo-jev-agent-router
```

## Develop

```sh
npm install
npm run typecheck
npm test
paseo plugin add "$PWD"          # install your checkout
paseo plugin reload jev-agent-router
paseo plugin logs jev-agent-router
```
