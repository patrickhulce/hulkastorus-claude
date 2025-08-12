"use client";

import React, {useState, useEffect} from "react";

interface DashboardStats {
  totalFiles: number;
  totalSizeBytes: number;
  filesByStatus: {
    validated: number;
    reserved: number;
    failed: number;
  };
  filesByPermissions: {
    public: number;
    private: number;
  };
  recentFiles: Array<{
    id: string;
    filename: string;
    createdAt: string;
    sizeBytes: number;
  }>;
}

interface DashboardStatsProps {
  refreshTrigger?: number;
}

export function DashboardStats({refreshTrigger}: DashboardStatsProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalFiles: 0,
    totalSizeBytes: 0,
    filesByStatus: {validated: 0, reserved: 0, failed: 0},
    filesByPermissions: {public: 0, private: 0},
    recentFiles: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch file counts and recent files
      const [allFilesResponse, recentFilesResponse] = await Promise.all([
        fetch("/api/v1/files?limit=1000"), // Get all files for stats
        fetch("/api/v1/files?limit=5&order_by=createdAt+desc"), // Get recent files
      ]);

      if (!allFilesResponse.ok || !recentFilesResponse.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const allFiles = await allFilesResponse.json();
      const recentFiles = await recentFilesResponse.json();

      // Calculate stats
      const totalFiles = allFiles.files.length;
      const totalSizeBytes = allFiles.files.reduce(
        (sum: number, file: {sizeBytes?: number}) => sum + (file.sizeBytes || 0),
        0,
      );

      const filesByStatus = allFiles.files.reduce(
        (acc: Record<string, number>, file: {status: string}) => {
          acc[file.status] = (acc[file.status] || 0) + 1;
          return acc;
        },
        {validated: 0, reserved: 0, failed: 0},
      );

      const filesByPermissions = allFiles.files.reduce(
        (acc: Record<string, number>, file: {permissions: string}) => {
          acc[file.permissions] = (acc[file.permissions] || 0) + 1;
          return acc;
        },
        {public: 0, private: 0},
      );

      setStats({
        totalFiles,
        totalSizeBytes,
        filesByStatus,
        filesByPermissions,
        recentFiles: recentFiles.files,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const formatFileSize = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900 p-6 rounded-lg">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-8 bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Main Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Total Files</h3>
          <div className="text-3xl font-bold text-white">{stats.totalFiles}</div>
          <div className="text-sm text-gray-400 mt-1">
            {stats.filesByStatus.validated} validated, {stats.filesByStatus.reserved} pending
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Storage Used</h3>
          <div className="text-3xl font-bold text-white">{formatFileSize(stats.totalSizeBytes)}</div>
          <div className="text-sm text-gray-400 mt-1">Across all files</div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Public Files</h3>
          <div className="text-3xl font-bold text-white">{stats.filesByPermissions.public}</div>
          <div className="text-sm text-gray-400 mt-1">
            {stats.filesByPermissions.private} private files
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Success Rate</h3>
          <div className="text-3xl font-bold text-white">
            {stats.totalFiles > 0
              ? Math.round((stats.filesByStatus.validated / stats.totalFiles) * 100)
              : 0}
            %
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {stats.filesByStatus.failed} failed uploads
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Recent Uploads</h3>
          {stats.recentFiles.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No files uploaded yet</div>
          ) : (
            <div className="space-y-3">
              {stats.recentFiles.map(file => (
                <div key={file.id} className="flex justify-between items-center py-2">
                  <div>
                    <div className="font-medium text-white truncate">{file.filename}</div>
                    <div className="text-sm text-gray-400">{formatDate(file.createdAt)}</div>
                  </div>
                  <div className="text-sm text-gray-300">{formatFileSize(file.sizeBytes)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">File Status Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-green-400">✓ Validated</span>
              <span className="font-medium">{stats.filesByStatus.validated}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-yellow-400">⏳ Reserved</span>
              <span className="font-medium">{stats.filesByStatus.reserved}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-400">✗ Failed</span>
              <span className="font-medium">{stats.filesByStatus.failed}</span>
            </div>
            <hr className="border-gray-700" />
            <div className="flex justify-between items-center font-semibold">
              <span>Total</span>
              <span>{stats.totalFiles}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}