// Small line icons in the page's style (they follow the text color)
const base = { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const UploadIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 16V5" />
    <path d="M7.5 9.5 12 5l4.5 4.5" />
    <path d="M4 15.5v2.2A2.3 2.3 0 0 0 6.3 20h11.4a2.3 2.3 0 0 0 2.3-2.3v-2.2" />
  </svg>
);
export const SparkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.3l-1.9-5.5L4.5 10.9 10.1 9 12 3.5Z" />
    <path d="M19 3.5v3M17.5 5h3" />
  </svg>
);
export const FileIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7l-4-4Z" />
    <path d="M14 3v4h4M9 13h6M9 16.5h6" />
  </svg>
);
export const CheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12.5 10 17.5 19 7.5" />
  </svg>
);
