import {
  parseLifecyclePolicy,
  lifecyclePolicies,
  resetR2Client,
  getR2Client,
} from "../../src/lib/r2-config";
// Jest globals are available without import in this project

describe("R2Config", () => {
  beforeEach(() => {
    resetR2Client();
  });

  describe("parseLifecyclePolicy", () => {
    it("should return valid lifecycle policies", () => {
      expect(parseLifecyclePolicy("infinite")).toBe("infinite");
      expect(parseLifecyclePolicy("180d")).toBe("180d");
      expect(parseLifecyclePolicy("90d")).toBe("90d");
      expect(parseLifecyclePolicy("30d")).toBe("30d");
      expect(parseLifecyclePolicy("14d")).toBe("14d");
      expect(parseLifecyclePolicy("7d")).toBe("7d");
      expect(parseLifecyclePolicy("3d")).toBe("3d");
      expect(parseLifecyclePolicy("2d")).toBe("2d");
      expect(parseLifecyclePolicy("1d")).toBe("1d");
    });

    it("should return infinite for invalid policies", () => {
      expect(parseLifecyclePolicy("invalid")).toBe("infinite");
      expect(parseLifecyclePolicy("")).toBe("infinite");
      expect(parseLifecyclePolicy("5d")).toBe("infinite");
      expect(parseLifecyclePolicy("forever")).toBe("infinite");
    });

    it("should be case sensitive", () => {
      expect(parseLifecyclePolicy("INFINITE")).toBe("infinite");
      expect(parseLifecyclePolicy("30D")).toBe("infinite");
    });
  });

  describe("lifecyclePolicies", () => {
    it("should contain all expected policies", () => {
      expect(lifecyclePolicies.INFINITE).toBe("infinite");
      expect(lifecyclePolicies.DAYS_180).toBe("180d");
      expect(lifecyclePolicies.DAYS_90).toBe("90d");
      expect(lifecyclePolicies.DAYS_30).toBe("30d");
      expect(lifecyclePolicies.DAYS_14).toBe("14d");
      expect(lifecyclePolicies.DAYS_7).toBe("7d");
      expect(lifecyclePolicies.DAYS_3).toBe("3d");
      expect(lifecyclePolicies.DAYS_2).toBe("2d");
      expect(lifecyclePolicies.DAYS_1).toBe("1d");
    });

    it("should have unique values", () => {
      const values = Object.values(lifecyclePolicies);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("getR2Client", () => {
    it("should return singleton instance", () => {
      const client1 = getR2Client();
      const client2 = getR2Client();

      expect(client1).toBe(client2);
    });

    it("should create new instance after reset", () => {
      const client1 = getR2Client();
      resetR2Client();
      const client2 = getR2Client();

      expect(client1).not.toBe(client2);
    });
  });
});
