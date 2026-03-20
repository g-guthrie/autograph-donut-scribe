export class DevOverlay {
  private readonly stats = document.createElement("div");
  private readonly status = document.createElement("div");
  private readonly note = document.createElement("div");

  constructor(parent: HTMLElement) {
    this.stats.className = "overlay";
    this.status.className = "status-pill";
    this.note.className = "center-note";
    parent.appendChild(this.stats);
    parent.appendChild(this.status);
    parent.appendChild(this.note);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setNote(text: string): void {
    this.note.textContent = text;
  }

  setStats(stats: Record<string, string>): void {
    const items = Object.entries(stats)
      .map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`)
      .join("");
    this.stats.innerHTML = `
      <p class="overlay-title">Olympus Phase 1</p>
      <p class="overlay-copy">Movement, camera, chunks, and room sync only. No combat systems are active in this phase.</p>
      <div class="overlay-grid">${items}</div>
    `;
  }
}
