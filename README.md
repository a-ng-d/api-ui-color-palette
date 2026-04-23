# UI Color Palette API

REST API built on Cloudflare Workers that powers the UI Color Palette ecosystem. It provides palette generation, color harmony, dominant color extraction, code generation, AI-powered color suggestions, and palette publishing/sharing.

## Endpoints

### Palette Generation

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/get-full-palette` | Generate a complete color palette from base and theme configurations |
| `POST` | `/create-color-harmony` | Create color harmonies (complementary, analogous, triadic, etc.) from a base color |
| `POST` | `/extract-dominant-colors` | Extract dominant colors from a JPEG/PNG image (URL, raw data, or multipart upload) |
| `POST` | `/generate-code` | Generate design tokens/code directly from base + themes (CSS, SCSS, Tailwind, Swift, Compose, etc.) |
| `POST` | `/generate-colors-from-prompts` | Generate a color palette from a natural language description via Mistral AI |

#### POST /generate-code

Expects palette inputs as `base` and `themes` (not `paletteData`).

Request body:

```json
{
	"base": { "...": "..." },
	"themes": [{ "...": "..." }],
	"format": "css",
	"colorSpace": "RGB"
}
```

Supported `format` values:

- `css`
- `scss`
- `less`
- `tailwind-v3`
- `tailwind-v4`
- `swift-ui`
- `ui-kit`
- `compose`
- `resources`
- `csv`
- `native-tokens`
- `dtcg-tokens`
- `style-dictionary-v3`
- `universal-json`

### Authentication

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/authenticate` | Start a passkey-based authentication flow (SSE) |

### Published Palettes

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| `GET` | `/list-published-palettes` | No | List publicly shared palettes (paginated, searchable) |
| `GET` | `/list-my-published-palettes` | Yes | List the authenticated user's own palettes |
| `POST` | `/publish-palette` | Yes | Publish a new palette |
| `GET` | `/get-published-palette/:id` | No | Get a specific shared palette by ID |
| `POST` | `/share-published-palette/:id` | Yes | Make a palette publicly visible |
| `POST` | `/unshare-published-palette/:id` | Yes | Make a palette private |
| `POST` | `/update-published-palette/:id` | Yes | Update an existing palette |
| `DELETE` | `/unpublish-palette/:id` | Yes | Permanently delete a palette |

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Palette Engine**: [@a_ng_d/utils-ui-color-palette](https://github.com/a-ng-d/utils-ui-color-palette)
- **AI**: Mistral AI
- **Database**: Supabase (PostgreSQL)
- **Image Decoding**: @jsquash/jpeg, @jsquash/png

## Development

```bash
npm install
npm run dev        # Start local dev server
npm run test       # Run tests
npm run deploy     # Deploy to Cloudflare
```

### Environment Variables

| Variable | Description |
| -------- | ----------- |
| `MISTRAL_API_KEY` | Mistral AI API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_PALETTES_TABLE` | Palettes table name |
| `SUPABASE_PALETTES_VIEW` | Palettes view name (with creator info) |
| `AUTH_WORKER_URL` | Auth worker URL for passkey flow |
| `AUTH_URL` | Frontend auth URL |

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
