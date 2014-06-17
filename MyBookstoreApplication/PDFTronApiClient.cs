using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Data;
using System.Net;
using System.Xml;
using System.IO;
using System.Xml.Linq;
using System.Text;

namespace MyBookstoreApplication
{
    public class PDFTronApiClient
    {
        const string ApiEndPoint = "https://api.pdftron.com/v2";
        //const string ApiId = "0d4090ccaa2040b1a8b4251eef6b4db3";
        //const string ApiSecret = "7622e99f315443f5adaaeac0f485e639";
        const string ApiId = "13395f7b35be491b9f3f1d879055a058";
        const string ApiSecret = "c152a3fa9c654ca89eceace886911747";

        private class PDFTronWebClient : WebClient
        {
            private WebResponse m_Resp = null;
            public int Timeout { get; set; }

            public PDFTronWebClient(String apiId, String apiSecret)
            {
                if (String.IsNullOrEmpty(apiId) || String.IsNullOrEmpty(apiSecret))
                {
                    throw new Exception("Please sign up for a free evaluation account at https://api.pdftron.com to obtain an API key and secret.");
                }
                this.Credentials = new NetworkCredential(apiId, apiSecret);
                this.Headers.Add(HttpRequestHeader.UserAgent, "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)");
            }

            /// <summary>
            /// Override the default WebRequest to lengthen the timeout.
            /// This is done to accomodate uploading large files.
            /// </summary>
            /// <param name="address"></param>
            /// <returns></returns>
            protected override WebRequest GetWebRequest(Uri address)
            {
                //lengthen the default timeout
                WebRequest w = base.GetWebRequest(address);
                w.Timeout *= 50;
                return w;
            }

            public HttpStatusCode StatusCode
            {
                get
                {
                    if (m_Resp != null && m_Resp is HttpWebResponse)
                        return (m_Resp as HttpWebResponse).StatusCode;
                    else
                        return HttpStatusCode.OK;
                }
            }

        }


        public DataSet listDocuments(int pageIndex, int pageSize)
        {
            WebClient client = new PDFTronWebClient(ApiId, ApiSecret);
            
            // get a list of documents
            string requestUrl = ApiEndPoint + "/document?pageIndex=" + pageIndex + "&pageSize=" + pageSize;
            string xmlResult = client.DownloadString(requestUrl);

            //parse the xml response, create a DataSet out of the data that can be used directly in ASP Web controls
            DataSet ds = new DataSet();
            ds.ReadXmlSchema(HttpContext.Current.Server.MapPath("~/Schema/documents.xsd"));
            ds.ReadXml(new XmlTextReader(new StringReader(xmlResult)));
            return ds;
        }

        public DataSet getDocumentInfo(String documentId)
        {
            WebClient client = new PDFTronWebClient(ApiId, ApiSecret);

            // get a list of documents
            string requestUrl = ApiEndPoint + "/document/" + documentId;
            string xmlResult = client.DownloadString(requestUrl);

            //parse the xml response, create a DataSet out of the data that can be used directly in ASP Web controls
            DataSet ds = new DataSet();
            //ds.ReadXmlSchema(HttpContext.Current.Server.MapPath("~/Schema/document.xsd"));
            ds.ReadXml(new XmlTextReader(new StringReader(xmlResult)));
            return ds;
        }

        public string uploadDocumentAndShare(String filePath)
        {
            WebClient client = new PDFTronWebClient(ApiId, ApiSecret);

            //create a new document by uploading a file
            string requestUrl = ApiEndPoint + "/document";
            byte[] response = client.UploadFile(requestUrl, "POST", filePath);

            //extract the Id of the document created
            XDocument documentXml = XDocument.Parse(UTF8Encoding.UTF8.GetString(response));
            String documentId = documentXml.Element("document").Element("documentId").Value;

            //share the document we just created
            client.UploadData(ApiEndPoint + "/document/" + documentId + "/share", "POST", new Byte[] { });
            File.Delete(filePath);

            return documentId;
        }

        public string deleteDocument(String documentId)
        {
            string result = "";

            PDFTronWebClient client = new PDFTronWebClient(ApiId, ApiSecret);

            // get a list of documents
            string requestUrl = ApiEndPoint + "/document/" + documentId;

            try
            {
                byte[] ret = client.UploadData(requestUrl, "DELETE", new Byte[] { });
                // Get response header.
                result = client.StatusCode.ToString();
            }
            catch (WebException we)
            {
                result = we.Message;
            }

            return result;


        }

        public string download(String documentId, string type, bool redirect)
        {
            WebClient client = new PDFTronWebClient(ApiId, ApiSecret);
            String dlUrl = "-1";

            string sessionOrShareId = getShareId(documentId);

            try
            {
                string requestUrl = ApiEndPoint + "/download/" + sessionOrShareId + "?type=" + type + "&redirect=false";
                string xmlResult = client.DownloadString(requestUrl);

                //extract the share Id of the document 
                XDocument documentXml = XDocument.Parse(xmlResult);
                dlUrl = documentXml.Element("urlResponse").Element("url").Value;

            }
            catch (WebException we)
            {
                dlUrl = "-1";
            }


            return dlUrl;
        }

        public string getShareId(String documentId)
        {
            WebClient client = new PDFTronWebClient(ApiId, ApiSecret);
            String shareId = "-1";
            try
            {

                // get a list of documents
                string requestUrl = ApiEndPoint + "/document/" + documentId + "/share";
                string xmlResult = client.DownloadString(requestUrl);

                //extract the share Id of the document 
                XDocument documentXml = XDocument.Parse(xmlResult);
                shareId = documentXml.Element("share").Element("shareId").Value;

            }
            catch (WebException we)
            {
                shareId = "-1";
            }


            return shareId;
        }

        public string createSession(String documentId, int expiry)
        {
            string result = "";

            PDFTronWebClient client = new PDFTronWebClient(ApiId, ApiSecret);

            // get a list of documents
            string requestUrl = ApiEndPoint + "/document/" + documentId + "/session?expiry=" + expiry;

            try
            {
                byte[] ret = client.UploadData(requestUrl, "POST", new Byte[] { });
                // Get response header.
                XDocument documentXml = XDocument.Parse(UTF8Encoding.UTF8.GetString(ret));
                result = documentXml.Element("session").Element("sessionId").Value;
            }
            catch (WebException we)
            {
                result = we.Message;
            }

            return result;


        }
    }
}