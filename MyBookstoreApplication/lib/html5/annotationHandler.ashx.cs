using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;
using System.Linq;
using System.Web;
using System.Xml;

namespace MyBookstoreApplication.lib.html5
{
    /// <summary>
    /// Summary description for annotationHandler
    /// </summary>
    public class annotationHandler : IHttpHandler
    {
        public string documentId;
        public string currUser;
        public string userId;
        public string annotationPath;
        public string xfdfPath;
        public string xfdfData;

        public void ProcessRequest(HttpContext context)
        {
            documentId = context.Request.Params["did"];
            currUser = context.Request.Params["curruser"];
           string [] temp= currUser.Split('|');
           userId = temp[1];
            //PDFTron demo use files(xfdf) to store the annotations with xml
            //We should store the annotations in database 
            xfdfData= context.Server.UrlDecode(context.Request["data"]);

            annotationPath = context.Server.MapPath("~/annotations/");

            xfdfPath = FindXFDFPath(context);
            
            if (context.Request.HttpMethod == "GET")
            {
                LoadAnnotation(context);
            }
            if (context.Request.HttpMethod == "POST")
            {
                SaveAnnotation(context);
            }

        }

        public string FindXFDFPath(HttpContext context)
        {
            string filespath = string.Empty;

            if (!string.IsNullOrEmpty(documentId) && !string.IsNullOrEmpty(currUser))
            {
                if (!Directory.Exists(this.annotationPath))
                {
                    //directory not exist,make a new one
                    DirectoryInfo di = Directory.CreateDirectory(this.annotationPath);
                }
                filespath = Path.Combine(this.annotationPath+this.documentId+".xfdf");
            }
            else
            {
                filespath = Path.Combine(this.annotationPath, "default.xfdf");
            }
            return filespath;
        }
        public void SaveAnnotation(HttpContext context)
        {
            try
            {

                if (!string.IsNullOrEmpty(xfdfData))
                {
                    using (FileStream fs = new FileStream(this.xfdfPath, FileMode.OpenOrCreate))
                    {
                        StreamReader sr = new StreamReader(fs);

                        string resultXml = HandleWithAnnotationXml(sr.ReadToEnd(), xfdfData, userId);
                        
                        StreamWriter sw = new StreamWriter(fs);

                        sw.Write(resultXml);
                        sw.Close();
                    }
                }
            }
            catch(Exception e)
            {
                HttpContext.Current.Response.Write("Server Error");
            }
        }
        public void LoadAnnotation(HttpContext context)
        {
            if (File.Exists(xfdfPath))
            {
                string xfdfString=string.Empty;
                using(StreamReader sr=new StreamReader(xfdfPath))
                {
                    xfdfString = HandleWithAnnotationXml(sr.ReadToEnd(), userId);

                }
                context.Response.Headers.Add("Content-type", "text/xml");
                context.Response.Write(xfdfString);
            }
            else
            {
                context.Response.Write("No Content");
            }
        }

        public string HandleWithAnnotationXml(string xmlString,string userId)
        {

            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlString);
            XmlNode annotsList = xmlDoc.GetElementsByTagName("annots").Item(0);

            foreach (XmlNode annot in annotsList.ChildNodes)
            {
                XmlElement xmlElement = annot as XmlElement;
                if (xmlElement != null && xmlElement.GetAttribute("title") != userId)
                {
                    string uId = xmlElement.GetAttribute("title").Split('|')[1];
                    if (uId != userId)
                    {
                        xmlElement.RemoveAll();
                    }
                    else
                    {
                        xmlElement.SetAttribute("title", xmlElement.GetAttribute("title").Split('|')[0]);
                    }
                }
            }
           string result= xmlDoc.InnerXml;
           return result;
        }

        public string HandleWithAnnotationXml(string regionXmlString, string newXmlString, string userId)
        {
            string result=string.Empty;

            if(string.IsNullOrEmpty(regionXmlString))
            {
                return result = newXmlString;
            }

            //1.according to userId ,we need to delete the region element
            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(regionXmlString);
            XmlNode annotsList = xmlDoc.GetElementsByTagName("annots").Item(0);

            for (int i =annotsList.ChildNodes.Count-1; i >0; i--)
            {
                XmlElement xmlElement = annotsList.ChildNodes[i] as XmlElement;
                if (xmlElement != null && xmlElement.GetAttribute("title") != userId)
                {
                    string uId = xmlElement.GetAttribute("title").Split('|')[1];
                    if (uId == userId)
                    {
                        //xmlElement.RemoveAll();
                        annotsList.RemoveChild(xmlElement);
                    }
                }
            }

            string temp = xmlDoc.InnerXml;
            XmlDocument newXmlDoc = new XmlDocument();
            //deal with new 
            newXmlDoc.LoadXml(newXmlString);
            XmlNode newAnnotsList = newXmlDoc.GetElementsByTagName("annots").Item(0);
            foreach (XmlNode  newAnnot in newAnnotsList.ChildNodes)
            {
                XmlElement xmlElement = newAnnot as XmlElement;
                if(xmlElement!=null)
                {
                    annotsList.AppendChild(xmlDoc.ImportNode(xmlElement, true));
                }
            }
            
            result = xmlDoc.InnerXml;
            return result;
        }
       
        public bool IsReusable
        {
            get
            {
                return false;
            }
        }
    }



}