import { useEffect, useState } from "react";
import { useApp } from "../store/AppContext";
import { load, save } from "../services/storage";

interface WebsiteConfig {
  name: string;
  subtitle: string;
  description: string;
  logoText: string;
}

const STORAGE_KEY = "familybuild:v3:website-config";
const defaultWebsite: WebsiteConfig = {
  name: "FamilyBuild",
  subtitle: "Properties & Construction Management",
  description: "Coordinate projects, people, finance, and reporting in one place.",
  logoText: "FB",
};

export function WebsitePage() {
  const { user, showToast } = useApp();
  const [config, setConfig] = useState<WebsiteConfig>(() => load(STORAGE_KEY, defaultWebsite));

  useEffect(() => {
    save(STORAGE_KEY, config);
  }, [config]);

  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Website Management</h1>
          <p className="page-header__subtitle">Configure the application identity and presentation.</p>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Branding</h2>
            <p className="card__subtitle">Update the public-facing application identity.</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="site-name">Application name</label>
            <input
              id="site-name"
              value={config.name}
              onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="site-logo">Logo text</label>
            <input
              id="site-logo"
              value={config.logoText}
              maxLength={2}
              onChange={(e) => setConfig((prev) => ({ ...prev, logoText: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="site-subtitle">Subtitle</label>
            <input
              id="site-subtitle"
              value={config.subtitle}
              onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="site-description">Description</label>
            <textarea
              id="site-description"
              rows={4}
              value={config.description}
              onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => showToast("Website settings updated", "success")}
          >
            Save website settings
          </button>
        </div>
      </div>
    </div>
  );
}
