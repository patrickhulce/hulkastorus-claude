"use client";

import React from "react";

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({currentPath, onNavigate}: BreadcrumbProps) {
  const generateBreadcrumbs = () => {
    if (currentPath === "/") {
      return [{name: "Home", path: "/"}];
    }

    const parts = currentPath.split("/").filter(Boolean);
    const breadcrumbs = [{name: "Home", path: "/"}];

    let buildPath = "";
    parts.forEach((part) => {
      buildPath += "/" + part;
      breadcrumbs.push({
        name: part,
        path: buildPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && <span className="text-gray-600">/</span>}
          <button
            onClick={() => onNavigate(crumb.path)}
            className={`hover:text-white transition-colors ${
              index === breadcrumbs.length - 1 ? "text-white font-medium" : "hover:underline"
            }`}
            disabled={index === breadcrumbs.length - 1}
          >
            {crumb.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
