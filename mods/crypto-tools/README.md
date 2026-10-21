# Crypto Tools Mod for Discord Bot Factory (DBF)

A high-performance cryptographic utility mod for **Discord Bot Factory (DBF)**. Provides cryptographically secure random codes, PINs, UUIDs, hashes, and byte tokens using **pure native Node.js `crypto`** with zero external dependencies.

---

## 1. Node Overview: `Generate Random Code`

- **File**: `nodes/GenerateRandomCode.js`
- **Category**: `Crypto` (Searchable via `Utility/GenerateRandomCode`, `Crypto Tools`, `Random Code Generator`)
- **Inputs**: 1 flow input (`Trigger`)
- **Outputs**: 1 flow output (`Output`)
- **Theme Color**: Header `#0284c7` (Sky Blue) | Background `#082f49` (Deep Slate)

---

## 2. Supported Formats & Capabilities

| Format | Option Value | Output Example | Description |
| :--- | :--- | :--- | :--- |
| **Formatted Alphanumeric** | `alphanumeric` | `TOQS-BPUL` or `KEY-A7B2-9901` | Pattern-based formatting (defaults to `XXXX-XXXX`). |
| **Numeric PIN** | `pin` | `482910` (6 digits) | Cryptographically uniform numeric digits (4-8 digits or custom length). |
| **UUID v4** | `uuid` | `281f6f94-f622-44ad-bb68-06c45c4d1d98` | Standard RFC 4122 v4 unique identifier. |
| **SHA-256 Hash** | `sha256` | `49304551b92a6ad5740d31...` | 64-char hex digest of 32 random bytes or input text / `{variable}`. |
| **MD5 Hash** | `md5` | `cda8d472178cb37c1c900e...` | 32-char hex digest of 16 random bytes or input text / `{variable}`. |
| **Random Hex Bytes** | `hex` | `852b03825df1ee139dcf18...` | Arbitrary-length random hex bytes (e.g. 16 bytes = 32 hex chars). |

---

## 3. Pattern Syntax Reference (Formatted Alphanumeric)

When using `Formatted Alphanumeric`, define your token layout using standard placeholder tokens:

- **`X`**: Uppercase alphanumeric character (`[A-Z0-9]`)
- **`x`**: Lowercase alphanumeric character (`[a-z0-9]`)
- **`A`**: Uppercase letter (`[A-Z]`)
- **`a`**: Lowercase letter (`[a-z]`)
- **`#`** or **`9`**: Numeric digit (`[0-9]`)
- **`*`**: Mixed alphanumeric character (`[A-Za-z0-9]`)
- **`\`**: Escape prefix to preserve a literal token (e.g. `\X` renders as a literal `X`)
- **Literals**: Any other characters (such as `-`, `_`, `:`, `/`, ` `) are preserved as literals.

### Pattern Examples:
- `XXXX-XXXX`: Produces `K9W2-P7M4`
- `XXXX-XXXX-XXXX`: Produces `8F2A-9KD1-MQ74`
- `BOT-####-****`: Produces `BOT-4820-j8K2`
- `AUTH-\X-XXXX`: Produces `AUTH-X-B9K1`

---

## 4. Conditional Modal Visibility

- **`Format Pattern`**: Only displayed when format is `Formatted Alphanumeric`.
- **`PIN Length`**: Only displayed when format is `Numeric PIN`.
- **`Hex Byte Count`**: Only displayed when format is `Random Hex Bytes`.
- **`Input Text to Hash`**: Only displayed when format is `SHA-256 Hash` or `MD5 Hash`.

---

## 5. Flow Variables & Autocomplete

When configured with **Save Result to Variable** (e.g. `my_code`):

1. **Direct Value Access**:
   - `{my_code}` resolves directly to the generated code string (e.g. `TOQS-BPUL` or `482910`).
2. **Sub-Variable Access**:
   - `{my_code.code}`: The generated code string.
   - `{my_code.value}`: Alias for the generated code string.
   - `{my_code.format}`: The format used (`alphanumeric`, `pin`, `uuid`, `sha256`, `md5`, `hex`).
   - `{my_code.length}`: Total character length of the generated string.
   - `{my_code.timestamp}`: ISO-8601 generation timestamp.

*The editor includes an autocomplete enhancer that automatically suggests sub-variables when you type `{my_code.` inside any text or textarea modal field.*

---

## 6. Security & Cryptographic Uniformity

- Pure native Node.js `crypto` implementation (`require('crypto')`).
- Uses `crypto.randomInt` for all range-based character and digit selections, completely avoiding modulo bias.
- Uses `crypto.randomBytes` for high-entropy buffers and hashes.
- Zero external runtime dependencies.
