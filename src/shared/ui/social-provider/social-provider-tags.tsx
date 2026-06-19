import { Tag, Tooltip } from 'antd';
import type { CSSProperties } from 'react';

/**
 * 소셜 로그인 provider 브랜드 아이콘.
 *
 * 아이콘 패스는 무료(공개) 브랜드 아이콘에서 받아 프로젝트에 내장한다(외부 핫링크 없음):
 *  - 단색 글리프: Simple Icons (https://simpleicons.org, CC0)
 *  - Google 멀티컬러 "G": gilbarbara/logos (https://github.com/gilbarbara/logos)
 * 각 아이콘은 브랜드 색으로 렌더하며, Facebook/KakaoTalk 패스는 자체 배경(원/둥근사각)을
 * 포함한 공식 앱 아이콘 형태라 그대로 채우면 흰 글리프가 비쳐 보이는 정식 룩이 된다.
 * 알 수 없는 provider 는 라벨 텍스트 태그로 폴백한다(신규 provider 무중단 대응).
 */

// auth.identities.provider 코드 -> 화면 표시 라벨.
const providerLabels: Record<string, string> = {
  google: 'Google',
  kakao: 'Kakao',
  facebook: 'Facebook',
  apple: 'Apple',
  naver: 'Naver',
  twitter: 'Twitter',
  x: 'X (Twitter)',
  github: 'GitHub',
  azure: 'Microsoft',
  line: 'LINE'
};

// 24x24 viewBox 단색 글리프 패스 + 브랜드 색(Simple Icons 기준).
const monoIcons: Record<string, { color: string; path: string }> = {
  facebook: {
    color: '#1877F2',
    path: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z'
  },
  kakao: {
    color: '#FEE500',
    path: 'M22.125 0H1.875C.8394 0 0 .8394 0 1.875v20.25C0 23.1606.8394 24 1.875 24h20.25C23.1606 24 24 23.1606 24 22.125V1.875C24 .8394 23.1606 0 22.125 0zM12 18.75c-.591 0-1.1697-.0413-1.7317-.1209-.5626.3965-3.813 2.6797-4.1198 2.7225 0 0-.1258.0489-.2328-.0141s-.0876-.2282-.0876-.2282c.0322-.2198.8426-3.0183.992-3.5333-2.7452-1.36-4.5701-3.7686-4.5701-6.5135C2.25 6.8168 6.6152 3.375 12 3.375s9.75 3.4418 9.75 7.6875c0 4.2457-4.3652 7.6875-9.75 7.6875zM8.0496 9.8672h-.8777v3.3417c0 .2963-.2523.5372-.5625.5372s-.5625-.2409-.5625-.5372V9.8672h-.8777c-.3044 0-.552-.2471-.552-.5508s.2477-.5508.552-.5508h2.8804c.3044 0 .552.2471.552.5508s-.2477.5508-.552.5508zm10.9879 2.9566a.558.558 0 0 1 .108.4167.5588.5588 0 0 1-.2183.371.5572.5572 0 0 1-.3383.1135.558.558 0 0 1-.4493-.2236l-1.3192-1.7479-.1952.1952v1.2273a.5635.5635 0 0 1-.5627.5628.563.563 0 0 1-.5625-.5625V9.3281c0-.3102.2523-.5625.5625-.5625s.5625.2523.5625.5625v1.209l1.5694-1.5694c.0807-.0807.1916-.1252.312-.1252.1404 0 .2814.0606.3871.1661.0985.0984.1573.2251.1654.3566.0082.1327-.036.2542-.1241.3425l-1.2818 1.2817 1.3845 1.8344zm-8.3502-3.5023c-.095-.2699-.3829-.5475-.7503-.5557-.3663.0083-.6542.2858-.749.5551l-1.3455 3.5415c-.1708.5305-.0217.7272.1333.7988a.8568.8568 0 0 0 .3576.0776c.2346 0 .4139-.0952.4678-.2481l.2787-.7297 1.7152.0001.2785.7292c.0541.1532.2335.2484.4681.2484a.8601.8601 0 0 0 .3576-.0775c.1551-.0713.3041-.2681.1329-.7999l-1.3449-3.5398zm-1.3116 2.4433l.5618-1.5961.5618 1.5961H9.3757zm5.9056 1.3836c0 .2843-.2418.5156-.5391.5156h-1.8047c-.2973 0-.5391-.2314-.5391-.5156V9.3281c0-.3102.2576-.5625.5742-.5625s.5742.2523.5742.5625v3.3047h1.1953c.2974 0 .5392.2314.5392.5156z'
  },
  twitter: {
    color: '#1DA1F2',
    path: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z'
  },
  x: {
    color: '#000000',
    path: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z'
  },
  apple: {
    color: '#000000',
    path: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701'
  },
  naver: {
    color: '#03C75A',
    path: 'M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z'
  }
};

const ICON_BOX_SIZE = 20;
const ICON_GLYPH_SIZE = 18;

const boxStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: ICON_BOX_SIZE,
  height: ICON_BOX_SIZE,
  marginInlineEnd: 6,
  verticalAlign: 'middle'
};

function MonoGlyph({ color, path }: { color: string; path: string }): JSX.Element {
  return (
    <svg
      width={ICON_GLYPH_SIZE}
      height={ICON_GLYPH_SIZE}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} fill={color} />
    </svg>
  );
}

// Google 멀티컬러 "G" (gilbarbara/logos, viewBox 256x262).
function GoogleGlyph(): JSX.Element {
  return (
    <svg
      width={ICON_GLYPH_SIZE}
      height={ICON_GLYPH_SIZE}
      viewBox="0 0 256 262"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M255.878,133.451 C255.878,122.717 255.007,114.884 253.122,106.761 L130.55,106.761 L130.55,155.209 L202.497,155.209 C201.047,167.249 193.214,185.381 175.807,197.565 L175.563,199.187 L214.318,229.21 L217.003,229.478 C241.662,206.704 255.878,173.196 255.878,133.451"
      />
      <path
        fill="#34A853"
        d="M130.55,261.1 C165.798,261.1 195.389,249.495 217.003,229.478 L175.807,197.565 C164.783,205.253 149.987,210.62 130.55,210.62 C96.027,210.62 66.726,187.847 56.281,156.37 L54.75,156.5 L14.452,187.687 L13.925,189.152 C35.393,231.798 79.49,261.1 130.55,261.1"
      />
      <path
        fill="#FBBC05"
        d="M56.281,156.37 C53.525,148.247 51.93,139.543 51.93,130.55 C51.93,121.556 53.525,112.853 56.136,104.73 L56.063,103 L15.26,71.312 L13.925,71.947 C5.077,89.644 0,109.517 0,130.55 C0,151.583 5.077,171.455 13.925,189.152 L56.281,156.37"
      />
      <path
        fill="#EB4335"
        d="M130.55,50.479 C155.064,50.479 171.6,61.068 181.029,69.917 L217.873,33.943 C195.245,12.91 165.798,0 130.55,0 C79.49,0 35.393,29.301 13.925,71.947 L56.136,104.73 C66.726,73.253 96.027,50.479 130.55,50.479"
      />
    </svg>
  );
}

function renderGlyph(provider: string): JSX.Element | null {
  const key = provider.trim().toLowerCase();
  if (key === 'google') {
    return <GoogleGlyph />;
  }
  const icon = monoIcons[key];
  if (icon) {
    return <MonoGlyph color={icon.color} path={icon.path} />;
  }
  return null;
}

function toLabel(provider: string): string {
  const key = provider.trim().toLowerCase();
  if (providerLabels[key]) {
    return providerLabels[key];
  }
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : provider;
}

type SocialProviderTagsProps = {
  // 연동된 소셜 provider 목록('email' 제외). 빈 배열이면 미연동으로 '-' 표시.
  providers: string[];
  // 미연동 시 표시할 마커(기본 '-').
  emptyText?: string;
};

export function SocialProviderTags({
  providers,
  emptyText = '-'
}: SocialProviderTagsProps): JSX.Element {
  if (!providers || providers.length === 0) {
    return <span>{emptyText}</span>;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
      {providers.map((provider) => {
        const label = toLabel(provider);
        const glyph = renderGlyph(provider);
        if (!glyph) {
          // 아이콘이 없는 provider 는 라벨 텍스트 태그로 폴백.
          return (
            <Tag key={provider} style={{ marginInlineEnd: 6 }}>
              {label}
            </Tag>
          );
        }
        return (
          <Tooltip key={provider} title={label}>
            <span style={boxStyle} role="img" aria-label={label}>
              {glyph}
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
}
