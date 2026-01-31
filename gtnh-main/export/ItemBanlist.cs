namespace Source
{
    public static class ItemBanlist
    {
        private static Dictionary<(string mod, string name), Func<string, string, bool>> BanList = new Dictionary<(string mod, string name), Func<string, string, bool>>()
        {
            {("Botania", "twigWand"), null},
            {("Forestry", "beeDroneGE"), null},
            {("Forestry", "beeLarvaeGE"), null},
            {("Forestry", "beePrincessGE"), null},
            {("Forestry", "beeQueenGE"), null},
            {("Forestry", "caterpillarGE"), null},
            {("Forestry", "pollenFertile"), null},
            {("ForbiddenMagic", "MobCrystal"), null},
            {("IC2", "itemCropSeed"), null},
            {("TConstruct", "ArrowAmmo"), null},
            {("TConstruct", "BoltAmmo"), null},
            {("TConstruct", "BoltPart"), null},
            {("TConstruct", "BowLimbPart"), null},
            {("TConstruct", "CrossbowBodyPart"), null},
            {("TConstruct", "CrossbowLimbPart"), null},
            {("TConstruct", "Crossbow"), null},
            {("TConstruct", "Javelin"), null},
            {("TConstruct", "LongBow"), null},
            {("TConstruct", "ShortBow"), null},
            {("TConstruct", "ShurikenPart"), null},
            {("TConstruct", "Shuriken"), null},
            {("TConstruct", "ThrowingKnife"), null},
            {("TConstruct", "arrowhead"), null},
            {("TConstruct", "battleaxe"), null},
            {("TConstruct", "battlesign"), null},
            {("TConstruct", "binding"), null},
            {("TConstruct", "broadAxeHead"), null},
            {("TConstruct", "broadsword"), null},
            {("TConstruct", "chiselHead"), null},
            {("TConstruct", "chisel"), null},
            {("TConstruct", "cleaver"), null},
            {("TConstruct", "creativeModifier"), null},
            {("TConstruct", "crossbar"), null},
            {("TConstruct", "cutlass"), null},
            {("TConstruct", "dagger"), null},
            {("TConstruct", "excavatorHead"), null},
            {("TConstruct", "excavator"), null},
            {("TConstruct", "frypanHead"), null},
            {("TConstruct", "frypan"), null},
            {("TConstruct", "fullGuard"), null},
            {("TConstruct", "hammerHead"), null},
            {("TConstruct", "hammer"), null},
            {("TConstruct", "handGuard"), null},
            {("TConstruct", "hatchetHead"), null},
            {("TConstruct", "hatchet"), null},
            {("TConstruct", "knifeBlade"), null},
            {("TConstruct", "largeSwordBlade"), null},
            {("TConstruct", "longsword"), null},
            {("TConstruct", "lumberaxe"), null},
            {("TConstruct", "mattock"), null},
            {("TConstruct", "pickaxeHead"), null},
            {("TConstruct", "pickaxe"), null},
            {("TConstruct", "rapier"), null},
            {("TConstruct", "scytheBlade"), null},
            {("TConstruct", "scythe"), null},
            {("TConstruct", "shovelHead"), null},
            {("TConstruct", "shovel"), null},
            {("TConstruct", "signHead"), null},
            {("TConstruct", "swordBlade"), null},
            {("TConstruct", "toolRod"), null},
            {("TConstruct", "toolShard"), null},
            {("TConstruct", "toughBinding"), null},
            {("TConstruct", "toughRod"), null},
            {("TGregworks", "tGregToolPartArrowHead"), null},
            {("TGregworks", "tGregToolPartAxeHead"), null},
            {("TGregworks", "tGregToolPartBinding"), null},
            {("TGregworks", "tGregToolPartBowLimb"), null},
            {("TGregworks", "tGregToolPartChiselHead"), null},
            {("TGregworks", "tGregToolPartChunk"), null},
            {("TGregworks", "tGregToolPartCrossbar"), null},
            {("TGregworks", "tGregToolPartCrossbowBody"), null},
            {("TGregworks", "tGregToolPartCrossbowLimb"), null},
            {("TGregworks", "tGregToolPartExcavatorHead"), null},
            {("TGregworks", "tGregToolPartFrypanHead"), null},
            {("TGregworks", "tGregToolPartFullGuard"), null},
            {("TGregworks", "tGregToolPartHammerHead"), null},
            {("TGregworks", "tGregToolPartKnifeBlade"), null},
            {("TGregworks", "tGregToolPartLargeGuard"), null},
            {("TGregworks", "tGregToolPartLargeSwordBlade"), null},
            {("TGregworks", "tGregToolPartLumberHead"), null},
            {("TGregworks", "tGregToolPartMediumGuard"), null},
            {("TGregworks", "tGregToolPartPickaxeHead"), null},
            {("TGregworks", "tGregToolPartScytheHead"), null},
            {("TGregworks", "tGregToolPartShovelHead"), null},
            {("TGregworks", "tGregToolPartShuriken"), null},
            {("TGregworks", "tGregToolPartSignHead"), null},
            {("TGregworks", "tGregToolPartSwordBlade"), null},
            {("TGregworks", "tGregToolPartToolRod"), null},
            {("TGregworks", "tGregToolPartToughBind"), null},
            {("TGregworks", "tGregToolPartToughRod"), null},
            {("gendustry", "GeneSample"), null},
            {("tinkersdefense", "Heater Shield"), null},
            {("tinkersdefense", "Round Shield"), null},
            {("witchery", "louse"), null},
            {("witchery", "poppet"), null},
            
            {("gadomancy", "ItemEtherealFamiliar"), null},
            
            {("gregtech", "gt.detrav.metatool.01"), (name, nbt) => name.Contains("Prospector's Scanner", StringComparison.Ordinal)},
            {("gregtech", "gt.metaitem.01"), (name, nbt) =>
                {
                    if (name == "Data Orb")
                        return nbt != "";
                    return name is "Writes Research result" or "Reads Research result";
                }
            },
            {
                ("gregtech", "gt.metaitem.02"), (name, nbt) => name.EndsWith("Wrench Tip", StringComparison.Ordinal) || 
                                                               name.EndsWith("Spade Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Pickaxe Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Sense Blade", StringComparison.Ordinal) ||
                                                               name.EndsWith("Plow Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Buzzsaw Blade", StringComparison.Ordinal) ||
                                                               //x.EndsWith("Turbine Blade", StringComparison.Ordinal) ||
                                                               name.EndsWith("Sword Blade", StringComparison.Ordinal) ||
                                                               name.EndsWith("Axe Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Hoe Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Hammer Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("File Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Shovel Head", StringComparison.Ordinal) ||
                                                               name.EndsWith("Drill Tip", StringComparison.Ordinal)
            },
            {
                // Remove GT steam cell in favor of IC2 steam cell
                ("gregtech", "gt.metaitem.98"), (name, nbt) => name == "Steam Cell"
            },
            {("gregtech", "gt.metatool.01"), null},
            {("miscutils", "gt.plusplus.metatool.01"), (name, nbt) => name is "Angle Grinder" or "Automatic Snips"},
            //{("bartworks", "gt.bwMetaGeneratedtoolHeadHammer"), null}
        };
        
        public static bool IsItemBanned(string mod, string internalName, string localizedName, string nbt)
        {
            if (BanList.TryGetValue((mod, internalName), out var processor))
                return processor == null || processor(localizedName, nbt);
            return false;
        }
    }
}