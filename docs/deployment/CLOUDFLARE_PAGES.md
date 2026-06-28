# Deploy Stixio Beta to Cloudflare Pages

## Recommended setup

```text
Project name: stixio-beta
Branch: main or develop
Build command: npm run build
Build output directory: dist
Custom domain: beta.stixio.app
```

## Steps

1. Open Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Create a Pages project.
4. Connect the GitHub repository.
5. Select the Stixio repository.
6. Set build command to `npm run build`.
7. Set output directory to `dist`.
8. Deploy.

## Beta privacy

Stixio Beta currently ships with:

```html
<meta name="robots" content="noindex,nofollow">
```

and:

```text
public/robots.txt
User-agent: *
Disallow: /
```

For stronger protection, use Cloudflare Access on `beta.stixio.app`.

## Production later

Production should use:

```text
stixio.app
```

Production can remove the noindex policy when ready.
