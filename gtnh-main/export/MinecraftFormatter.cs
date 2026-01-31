using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

public class MinecraftTextConverter
{
    public static string ToHtml(string minecraftText)
    {
        if (string.IsNullOrEmpty(minecraftText))
        {
            return "";
        }

        StringBuilder htmlBuilder = new StringBuilder();
        var currentSpanClasses = "";
        StringBuilder currentText = new StringBuilder();
        HashSet<char> activeFormats = new HashSet<char>();

        for (int i = 0; i < minecraftText.Length; i++)
        {
            if (minecraftText[i] == '§' && i + 1 < minecraftText.Length)
            {
                char formatCode = minecraftText[i + 1];
                i++; // Skip the format code

                if (formatCode == 'r')
                {
                    if (currentText.Length > 0 || currentSpanClasses.Length > 0)
                    {
                        EmitSpan(htmlBuilder, currentSpanClasses.ToString(), currentText.ToString());
                        currentText.Clear();
                        currentSpanClasses = "";
                        activeFormats.Clear();
                    }
                }
                else if (!activeFormats.Contains(formatCode))
                {
                    if (currentText.Length > 0 || currentSpanClasses.Length > 0)
                    {
                        EmitSpan(htmlBuilder, currentSpanClasses.ToString(), currentText.ToString());
                        currentText.Clear();
                    }

                    if (formatCode >= '0' && formatCode <= '9' || formatCode >= 'a' && formatCode <= 'f')
                        activeFormats.Clear();
                    activeFormats.Add(formatCode);
                    currentSpanClasses = string.Join(' ', activeFormats.Select(x => "fmt-" + x));
                }
                // If the format is repeated, we ignore it
            }
            else if (minecraftText[i] == '\n')
            {
                EmitSpan(htmlBuilder, currentSpanClasses.ToString(), currentText.ToString());
                currentText.Clear();
                currentSpanClasses = "";
                activeFormats.Clear();
                currentText.Append(minecraftText[i]);
            }
            else
            {
                currentText.Append(minecraftText[i]);
            }
        }

        // Emit any remaining text in the last span
        if (currentText.Length > 0 || currentSpanClasses.Length > 0)
        {
            EmitSpan(htmlBuilder, currentSpanClasses.ToString(), currentText.ToString());
        }

        return htmlBuilder.ToString();
    }

    private static void EmitSpan(StringBuilder htmlBuilder, string classes, string text)
    {
        if (!string.IsNullOrEmpty(text))
        {
            text = WebUtility.HtmlEncode(text).Replace("\n", "<br>");
            if (!string.IsNullOrEmpty(classes))
            {
                htmlBuilder.Append($"<span class=\"{classes}\">{text}</span>");
            }
            else
            {
                htmlBuilder.Append(text);
            }
        }
    }
}