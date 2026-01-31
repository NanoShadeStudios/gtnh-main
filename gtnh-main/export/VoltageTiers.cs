namespace export;

public static class VoltageTiers
{
    public static string[] voltageTiers = new string[] { "LV", "MV", "HV", "EV", "IV", "LuV", "ZPM", "UV", "UHV", "UEV", "UIV", "UMV", "UXV", "MAX" };


    public static int GetVoltageTier(string gtVoltageTier)
    {
        switch (gtVoltageTier)
        {
            case "LV": return 0;
            case "MV": return 1;
            case "HV": return 2;
            case "EV": return 3;
            case "IV": return 4;
            case "LuV": return 5;
            case "ZPM": return 6;
            case "UV": return 7;
            case "UHV": return 8;
            case "UEV": return 9;
            case "UIV": return 10;
            case "UMV": return 11;
            case "UXV": return 12;
            case "MAX": return 13;
            default: return 0;
        }
    }
}