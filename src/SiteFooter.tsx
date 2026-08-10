export function SiteFooter({ refreshedAt }: { refreshedAt?: string }) {
  return (
    <footer>
      <div>
        <strong>Game Night Library</strong>
        <p>A shared game inventory for finding what fits.</p>
      </div>
      <div class="footer-meta">
        <a
          class="bgg-attribution"
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={`${import.meta.env.BASE_URL}powered-by-bgg-rgb.svg`} alt="Powered by BGG" />
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
        <span>
          Metadata refreshed {refreshedAt ? new Date(refreshedAt).toLocaleDateString() : "—"}
        </span>
        <span class="footer-methodology">
          Play styles and match scores are Game Night Library inferences, not BoardGameGeek ratings
          or recommendations.
        </span>
      </div>
    </footer>
  );
}
